import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { CodexController, type CodexChildProcess } from '../development/codex-controller.js';
import type { DevelopmentEvent } from '../development/development-types.js';

class FakeProcess extends EventEmitter implements CodexChildProcess {
  pid = 4321;
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  emitJson(lines: string[]): void { this.stdout.write(`${lines.join('\n')}\n`); }
  finish(code = 0): void { this.stdout.end(); this.stderr.end(); this.emit('close', code, null); }
}

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
