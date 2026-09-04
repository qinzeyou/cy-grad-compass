import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { runMigrations } from '../database/migrations.js';
import { ProjectRepository } from '../database/project-repository.js';
import { DevelopmentRepository } from '../development/development-repository.js';
import { DevelopmentService } from '../development/development-service.js';
import type { CodexRunRequest } from '../development/codex-controller.js';
import type { DevelopmentEvent } from '../development/development-types.js';

class FakeController {
  readonly requests: CodexRunRequest[] = [];
  private listener: ((event: DevelopmentEvent) => void) | null = null;
  subscribe(listener: (event: DevelopmentEvent) => void): () => void { this.listener = listener; return () => { this.listener = null; }; }
  run(request: CodexRunRequest): Promise<void> { this.requests.push(request); return new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); }
  resolve: () => void = () => undefined;
  reject: (reason: Error) => void = () => undefined;
  stop(): Promise<void> { this.resolve(); return Promise.resolve(); }
  emit(event: DevelopmentEvent): void { this.listener?.(event); }
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'development-service-'));
  const projectPath = join(root, 'project');
  mkdirSync(projectPath);
  const database = new DatabaseSync(':memory:');
  runMigrations(database);
  const projects = new ProjectRepository(database);
  projects.insert({ id: 'project-1', name: '示例项目', path: projectPath, status: 'in-progress', templateId: 'default', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const repository = new DevelopmentRepository(database);
  const controller = new FakeController();
  const events: Array<{ sessionId: string; event: DevelopmentEvent }> = [];
  const service = new DevelopmentService(projects, repository, controller, (sessionId: string, event: DevelopmentEvent) => events.push({ sessionId, event }));
  return { root, database, projects, repository, controller, service, events, cleanup: () => { database.close(); rmSync(root, { recursive: true, force: true }); } };
}

test('讨论保存用户与 AI 消息并保存 thread id', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    const run = context.service.sendMessage(session.id, '先分析项目结构');
    context.controller.emit({ type: 'thread-started', threadId: 'thread-1' });
    context.controller.emit({ type: 'assistant-message', text: '结构分析完成' });
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;
    const saved = context.repository.getSession(session.id);
    assert.equal(saved?.codexThreadId, 'thread-1');
    assert.deepEqual(saved?.messages.map((item) => item.content), ['先分析项目结构', '结构分析完成']);
    assert.equal(context.controller.requests[0]?.sandbox, 'read-only');
  } finally { context.cleanup(); }
});

test('开始开发切换 phase 并使用 workspace-write', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    context.repository.saveThreadId(session.id, 'thread-1', new Date().toISOString());
    const run = context.service.startDevelopment(session.id);
    context.controller.emit({ type: 'turn-started' });
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;
    assert.equal(context.repository.getSession(session.id)?.phase, 'development');
    assert.equal(context.controller.requests[0]?.sandbox, 'workspace-write');
  } finally { context.cleanup(); }
});

test('项目路径不存在时不能创建开发会话', () => {
  const context = fixture();
  try {
    const projectId = randomUUID();
    context.projects.insert({ id: projectId, name: '坏项目', path: join(context.root, 'missing'), status: 'in-progress', templateId: 'default', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    assert.throws(() => context.service.createSession(projectId), /项目目录不存在/);
  } finally { context.cleanup(); }
});

test('删除开发会话及其消息', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    context.repository.addMessage({ id: 'message-1', sessionId: session.id, role: 'user', content: '待删除消息', createdAt: new Date().toISOString() });
    context.service.deleteSession(session.id);
    assert.equal(context.repository.getSession(session.id), null);
    assert.equal(context.repository.listSessions().some((item) => item.id === session.id), false);
  } finally { context.cleanup(); }
});

test('删除工作区只删除项目记录及其会话消息并保留本地目录', () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    context.repository.addMessage({ id: 'message-workspace', sessionId: session.id, role: 'user', content: '待删除', createdAt: new Date().toISOString() });
    context.service.deleteWorkspace('project-1');
    assert.equal(context.projects.findById('project-1'), null);
    assert.equal(context.repository.listSessions().length, 0);
    assert.equal(existsSync(join(context.root, 'project')), true);
  } finally { context.cleanup(); }
});

test('删除不存在的工作区时报错', () => {
  const context = fixture();
  try { assert.throws(() => context.service.deleteWorkspace('missing'), /项目不存在/); }
  finally { context.cleanup(); }
});

test('继续开发复用已有 thread 并使用 workspace-write', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    context.repository.saveThreadId(session.id, 'thread-1', new Date().toISOString());
    const run = context.service.continueDevelopment(session.id);
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;
    assert.equal(context.controller.requests[0]?.threadId, 'thread-1');
    assert.equal(context.controller.requests[0]?.sandbox, 'workspace-write');
    assert.match(context.controller.requests[0]?.prompt ?? '', /继续/);
  } finally { context.cleanup(); }
});

test('功能封装以只读方式运行并发布可确认的技能候选', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    const run = context.service.sendMessage(session.id, '封装推荐功能', 'feature-extraction');
    context.controller.emit({ type: 'assistant-message', text: '已完成分析。\n<skill-candidate>{"name":"个性化推荐","description":"复用推荐实现","instructions":"---\\nname: 个性化推荐\\ndescription: 复用推荐实现\\n---\\n\\n# 个性化推荐\\n\\n扫描并复用现有推荐逻辑。"}</skill-candidate>' });
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;

    assert.equal(context.controller.requests[0]?.sandbox, 'read-only');
    assert.match(context.controller.requests[0]?.prompt ?? '', /功能封装/);
    assert.equal(context.repository.getSession(session.id)?.messages[1]?.content, '已完成分析。');
    assert.deepEqual(context.events.find((item) => item.event.type === 'feature-extraction-ready')?.event, {
      type: 'feature-extraction-ready',
      candidate: { name: '个性化推荐', description: '复用推荐实现', instructions: '---\nname: 个性化推荐\ndescription: 复用推荐实现\n---\n\n# 个性化推荐\n\n扫描并复用现有推荐逻辑。' },
    });
  } finally { context.cleanup(); }
});

test('功能封装候选格式错误时保留 AI 回复并提示失败', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    const run = context.service.sendMessage(session.id, '封装推荐功能', 'feature-extraction');
    context.controller.emit({ type: 'assistant-message', text: '分析完成，但未生成候选。' });
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;

    assert.equal(context.repository.getSession(session.id)?.messages[1]?.content, '分析完成，但未生成候选。');
    assert.equal(context.events.some((item) => item.event.type === 'feature-extraction-failed'), true);
  } finally { context.cleanup(); }
});

test('功能封装分段回复时不会在成功提取前误报失败', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    const run = context.service.sendMessage(session.id, '封装推荐功能', 'feature-extraction');
    context.controller.emit({ type: 'assistant-message', text: '正在分析推荐功能的实现。' });
    assert.equal(context.events.some((item) => item.event.type === 'feature-extraction-failed'), false);

    context.controller.emit({ type: 'assistant-message', text: '<skill-candidate>{"name":"个性化推荐","description":"复用推荐实现","instructions":"---\\nname: 个性化推荐\\ndescription: 复用推荐实现\\n---\\n\\n# 个性化推荐\\n\\n扫描并复用现有推荐逻辑。"}</skill-candidate>' });
    context.controller.emit({ type: 'process-exited', exitCode: 0, stopped: false });
    context.controller.resolve();
    await run;

    assert.equal(context.events.some((item) => item.event.type === 'feature-extraction-ready'), true);
    assert.equal(context.events.some((item) => item.event.type === 'feature-extraction-failed'), false);
  } finally { context.cleanup(); }
});

test('功能封装运行失败后不会影响下一轮普通对话', async () => {
  const context = fixture();
  try {
    const session = context.service.createSession('project-1');
    const extraction = context.service.sendMessage(session.id, '封装推荐功能', 'feature-extraction');
    context.controller.reject(new Error('运行失败'));
    await assert.rejects(extraction, /运行失败/);

    const discussion = context.service.sendMessage(session.id, '继续讨论需求');
    context.controller.emit({ type: 'assistant-message', text: '普通 AI 回复' });
    context.controller.resolve();
    await discussion;

    assert.equal(context.events.some((item) => item.event.type === 'feature-extraction-ready' || item.event.type === 'feature-extraction-failed'), false);
  } finally { context.cleanup(); }
});
