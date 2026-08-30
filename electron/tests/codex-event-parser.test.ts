import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCodexJsonLine } from '../development/codex-event-parser.js';

test('解析 Codex 的 thread、AI、命令和文件变化事件', () => {
  assert.deepEqual(parseCodexJsonLine('{"type":"thread.started","thread_id":"thread-1"}'), { type: 'thread-started', threadId: 'thread-1' });
  assert.deepEqual(parseCodexJsonLine('{"type":"turn.started"}'), { type: 'turn-started' });
  assert.deepEqual(parseCodexJsonLine('{"type":"item.completed","item":{"id":"m1","type":"agent_message","text":"完成"}}'), { type: 'assistant-message', text: '完成' });
  assert.deepEqual(parseCodexJsonLine('{"type":"item.started","item":{"id":"c1","type":"command_execution","command":"npm test"}}'), { type: 'command-started', id: 'c1', command: 'npm test' });
  assert.deepEqual(parseCodexJsonLine('{"type":"item.completed","item":{"id":"f1","type":"file_change","changes":[{"path":"src/app.tsx"}]}}'), { type: 'file-change', paths: ['src/app.tsx'] });
  assert.deepEqual(parseCodexJsonLine('{"type":"turn.completed"}'), { type: 'turn-completed' });
});

test('损坏 JSONL 转成日志且不抛错', () => {
  assert.deepEqual(parseCodexJsonLine('not-json'), { type: 'log', text: 'not-json' });
});
