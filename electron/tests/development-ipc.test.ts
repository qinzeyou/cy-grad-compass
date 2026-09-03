import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerDevelopmentIpcHandlers } from '../development/development-handlers.js';
import type { DevelopmentEvent } from '../development/development-types.js';

test('开发 IPC 注册会话请求通道并校验字符串参数', () => {
  const registered = new Map<string, (...args: unknown[]) => unknown>();
  const service = {
    listSessions: () => [],
    getSession: (id: string) => ({ id }),
    createSession: (projectId: string) => ({ id: projectId }),
    sendMessage: (id: string, message: string) => Promise.resolve(`${id}:${message}`),
    startDevelopment: (id: string) => Promise.resolve(id),
    continueDevelopment: (id: string) => Promise.resolve(id),
    pause: (id: string) => Promise.resolve(id),
    stop: (id: string) => Promise.resolve(id),
    deleteSession: (id: string) => id,
  } as never;
  registerDevelopmentIpcHandlers(service, { handle: (channel, handler) => registered.set(channel, handler) });
  assert.deepEqual([...registered.keys()], [
    'development:list-sessions', 'development:get-session', 'development:create-session',
    'development:send-message', 'development:start', 'development:continue', 'development:pause', 'development:stop', 'development:delete-session',
  ]);
  assert.throws(() => registered.get('development:get-session')?.({}, '  '), /缺少开发会话编号/);
});

test('事件类型可以被 envelope 原样携带', () => {
  const event: DevelopmentEvent = { type: 'turn-started' };
  assert.deepEqual({ sessionId: 'session-1', event }, { sessionId: 'session-1', event });
});
