import { spawn, type ChildProcess } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { parseCodexJsonLine } from './codex-event-parser.js';
import type { DevelopmentEvent } from './development-types.js';

export interface CodexChildProcess {
  pid?: number;
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export type SpawnCodexProcess = (command: string, args: string[], options: { cwd: string }) => CodexChildProcess;
export type CodexSandbox = 'read-only' | 'workspace-write';

export interface CodexRunRequest {
  projectPath: string;
  threadId?: string;
  prompt: string;
  sandbox: CodexSandbox;
}

interface ActiveRun {
  child: CodexChildProcess;
  resolve: () => void;
  stopped: boolean;
}

function defaultSpawn(command: string, args: string[], options: { cwd: string }): CodexChildProcess {
  return spawn(command, args, { cwd: options.cwd, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) as unknown as ChildProcess;
}

// 中文注释：控制器只管理一个 Codex 子进程，避免多个任务同时修改同一项目目录。
export class CodexController {
  private readonly listeners = new Set<(event: DevelopmentEvent) => void>();
  private readonly spawnProcess: SpawnCodexProcess;
  private readonly terminateProcess: (pid: number | undefined) => Promise<void>;
  private activeRun: ActiveRun | null = null;

  constructor(dependencies: { spawn?: SpawnCodexProcess; terminate?: (pid: number | undefined) => Promise<void> } = {}) {
    this.spawnProcess = dependencies.spawn ?? defaultSpawn;
    this.terminateProcess = dependencies.terminate ?? (async (pid) => {
      if (pid === undefined) return;
      await new Promise<void>((resolve) => { const child = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }); child.once('close', () => resolve()); child.once('error', () => resolve()); });
    });
  }

  get isRunning(): boolean { return this.activeRun !== null; }

  subscribe(listener: (event: DevelopmentEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  run(request: CodexRunRequest): Promise<void> {
    if (this.activeRun !== null) return Promise.reject(new Error('已有 AI 任务正在运行'));
    const args = request.threadId === undefined
      ? ['-C', request.projectPath, '-s', request.sandbox, '-a', 'never', 'exec', '--json', '--skip-git-repo-check', '-']
      : ['-C', request.projectPath, '-s', request.sandbox, '-a', 'never', 'exec', 'resume', '--json', '--skip-git-repo-check', request.threadId, '-'];
    const child = this.spawnProcess('codex.cmd', args, { cwd: request.projectPath });
    if (child.stdin === null) return Promise.reject(new Error('Codex stdin 不可用'));
    let resolveRun!: () => void;
    const completion = new Promise<void>((resolve) => { resolveRun = resolve; });
    const run: ActiveRun = { child, resolve: resolveRun, stopped: false };
    this.activeRun = run;
    this.attachStream(child.stdout, (line) => { const event = parseCodexJsonLine(line); if (event) this.emit(event); });
    this.attachStream(child.stderr, (line) => { if (line.trim()) this.emit({ type: 'log', text: line }); });
    child.once('error', (error) => this.emit({ type: 'run-error', message: error.message }));
    child.once('close', (code) => {
      if (this.activeRun !== run) return;
      this.activeRun = null;
      this.emit({ type: 'process-exited', exitCode: code ?? 1, stopped: run.stopped });
      run.resolve();
    });
    child.stdin.end(request.prompt);
    return completion;
  }

  async stop(): Promise<void> {
    const run = this.activeRun;
    if (run === null) return;
    run.stopped = true;
    await this.terminateProcess(run.child.pid);
    await new Promise<void>((resolve) => { const check = () => this.activeRun === run ? setTimeout(check, 10) : resolve(); check(); });
  }

  private attachStream(stream: NodeJS.ReadableStream | null, onLine: (line: string) => void): void {
    if (stream === null) return;
    const decoder = new StringDecoder('utf8');
    let buffer = '';
    stream.on('data', (chunk: Buffer | string) => {
      buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach(onLine);
    });
    stream.on('end', () => { buffer += decoder.end(); if (buffer) onLine(buffer); });
  }

  private emit(event: DevelopmentEvent): void { this.listeners.forEach((listener) => listener(event)); }
}
