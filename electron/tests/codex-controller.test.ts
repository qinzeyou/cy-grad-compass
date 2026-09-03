import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { buildCodexSpawnInvocation, CodexController, type CodexChildProcess } from '../development/codex-controller.js';
import type { DevelopmentEvent } from '../development/development-types.js';

class FakeProcess extends EventEmitter implements CodexChildProcess {
  pid = 4321;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  emitJson(lines: string[]): void { this.stdout.write(`${lines.join('\n')}\n`); }
  finish(code = 0): void { this.stdout.end(); this.stderr.end(); this.emit('close', code, null); }
}

test('Windows .cmd 启动通过 cmd.exe，避免 spawn EINVAL', () => {
  const invocation = buildCodexSpawnInvocation('codex.cmd', ['--version']);
  if (process.platform === 'win32') assert.deepEqual(invocation, { command: 'cmd.exe', args: ['/d', '/s', '/c', 'codex.cmd', '--version'] });
  else assert.deepEqual(invocation, { command: 'codex.cmd', args: ['--version'] });
});

test('讨论使用 read-only，恢复开发使用 workspace-write', async () => {
  const invocations: string[][] = [];
  const processes: FakeProcess[] = [];
  const controller = new CodexController({
    spawn: (_command, args) => {
      invocations.push(args);
      const process = new FakeProcess();
      processes.push(process);
      queueMicrotask(() => { process.emitJson(['{"type":"thread.started","thread_id":"thread-1"}', '{"type":"turn.started"}', '{"type":"turn.completed"}']); process.finish(); });
      return process;
    },
  });
  const events: DevelopmentEvent[] = [];
  controller.subscribe((event) => events.push(event));

  await controller.run({ projectPath: 'C:\\project', prompt: '讨论需求', sandbox: 'read-only' });
  await controller.run({ projectPath: 'C:\\project', threadId: 'thread-1', prompt: '开始开发', sandbox: 'workspace-write' });

  assert.equal(processes.length, 2);
  assert.ok(invocations[0]?.includes('read-only'));
  assert.ok(invocations[1]?.includes('workspace-write'));
  assert.deepEqual(invocations[1]?.slice(-3), ['--skip-git-repo-check', 'thread-1', '-']);
  assert.ok(invocations.flat().every((item) => item !== 'danger-full-access'));
  assert.equal(events.filter((event) => event.type === 'thread-started').length, 2);
});

test('stop 终止活动进程并发布 stopped 退出事件', async () => {
  let process: FakeProcess | undefined;
  const controller = new CodexController({
    spawn: () => {
      process = new FakeProcess();
      return process;
    },
    terminate: async () => { process?.finish(1); },
  });
  const events: DevelopmentEvent[] = [];
  controller.subscribe((event) => events.push(event));
  const run = controller.run({ projectPath: 'C:\\project', prompt: '执行', sandbox: 'workspace-write' });
  await controller.stop();
  await run;
  assert.deepEqual(events.at(-1), { type: 'process-exited', exitCode: 1, stopped: true });
  assert.equal(controller.isRunning, false);
});

test('pause 终止活动进程并标记 paused 退出事件', async () => {
  let process: FakeProcess | undefined;
  const controller = new CodexController({
    spawn: () => {
      process = new FakeProcess();
      return process;
    },
    terminate: async () => { process?.finish(1); },
  });
  const events: DevelopmentEvent[] = [];
  controller.subscribe((event) => events.push(event));
  const run = controller.run({ projectPath: 'C:\\project', prompt: '执行', sandbox: 'workspace-write' });
  await controller.stop(true);
  await run;
  assert.deepEqual(events.at(-1), { type: 'process-exited', exitCode: 1, stopped: true, paused: true });
});
