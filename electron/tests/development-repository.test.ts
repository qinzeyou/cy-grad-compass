import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runMigrations } from '../database/migrations.js';
import { DevelopmentRepository } from '../development/development-repository.js';

test('开发会话可以持久化消息、Codex thread 和开发阶段', () => {
  const database = new DatabaseSync(':memory:');
  runMigrations(database);
  database.prepare(
    `INSERT INTO projects (id, name, path, status, template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('project-1', '示例项目', 'C:\\project', 'in-progress', 'default',
    '2026-08-30T09:00:00.000Z', '2026-08-30T09:00:00.000Z');
  const repository = new DevelopmentRepository(database);

  repository.createSession({
    id: 'session-1',
    projectId: 'project-1',
    title: '实现登录页',
    phase: 'discussion',
    createdAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.000Z',
  });
  repository.addMessage({
    id: 'message-1',
    sessionId: 'session-1',
    role: 'user',
    content: '实现登录页',
    createdAt: '2026-08-30T10:01:00.000Z',
  });
  repository.saveThreadId('session-1', 'thread-1', '2026-08-30T10:02:00.000Z');
  repository.updatePhase('session-1', 'development', '2026-08-30T10:03:00.000Z');

  const session = repository.getSession('session-1');
  assert.equal(session?.codexThreadId, 'thread-1');
  assert.equal(session?.phase, 'development');
  assert.equal(session?.projectName, '示例项目');
  assert.deepEqual(session?.messages.map((item) => item.content), ['实现登录页']);
  database.close();
});
