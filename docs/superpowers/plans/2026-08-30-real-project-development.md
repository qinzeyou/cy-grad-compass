# 真实 AI 项目开发模式实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有三栏模拟工作台替换为基于本机 Codex CLI 的真实项目讨论与开发流程。

**Architecture:** Electron 主进程持有 SQLite 会话数据和唯一活动 Codex 子进程，使用 `codex exec --json` 读取 JSONL 事件；preload 只暴露会话请求和事件订阅。React 继续复用现有三栏布局，左栏加载持久化会话，中栏展示真实消息，右栏显示当前 turn 的命令、文件变化、错误和耗时。

**Tech Stack:** Electron 44、React 19、TypeScript、Node.js 22 内置 `node:sqlite` / `node:test`、本机 Codex CLI 0.149.1。

**Spec:** `docs/superpowers/specs/2026-08-30-real-project-development-design.md`

## Global Constraints

- 所有新增代码必须包含中文注释，注释解释边界和原因。
- 文件与目录使用 `kebab-case`，TypeScript 标识符使用 `camelCase` / `PascalCase`。
- 单个文件原则上不超过 250 行，IPC、仓储、服务、进程和 UI 分开。
- 讨论阶段必须使用 `read-only`，开发阶段必须使用 `workspace-write`。
- 禁止 `danger-full-access` 和 `--dangerously-bypass-approvals-and-sandbox`。
- 同一时间只允许一个活动 Codex 子进程。
- 不新增 npm 依赖；使用 Node.js 标准库和现有 Electron API。
- 先写失败测试并确认预期失败，再写最小实现。
- 每个任务结束运行指定测试；最终运行 `npm test` 和 `npm run build`。

---

### Task 1: 开发会话数据模型与仓储

**Files:**
- Modify: `electron/database/migrations.ts`
- Modify: `electron/database/connection.ts`
- Create: `electron/development/development-types.ts`
- Create: `electron/development/development-repository.ts`
- Test: `electron/tests/development-repository.test.ts`

**Interfaces:**
- Consumes: `AppDatabase`、`ProjectRepository.findById(id)` 返回的项目 ID 关联。
- Produces: `DevelopmentRepository.createSession`、`listSessions`、`getSession`、`addMessage`、`saveThreadId`、`updateTitle`、`updatePhase`。

- [x] **Step 1: 写仓储失败测试**

在 `electron/tests/development-repository.test.ts` 创建内存数据库测试，明确会话、消息、thread 和 phase 行为：

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../database/migrations.js';
import { DevelopmentRepository } from '../development/development-repository.js';

test('开发会话可以持久化消息、Codex thread 和开发阶段', () => {
  const database = new DatabaseSync(':memory:');
  runMigrations(database);
  const repository = new DevelopmentRepository(database);

  database.prepare(
    `INSERT INTO projects (id, name, path, status, template_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run('project-1', '示例项目', 'C:\\project', 'in-progress', 'default',
    '2026-08-30T09:00:00.000Z', '2026-08-30T09:00:00.000Z');

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
  assert.deepEqual(session?.messages.map((item) => item.content), ['实现登录页']);
  database.close();
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `npm run build`

Expected: TypeScript 失败，提示找不到 `../development/development-repository.js`。

- [x] **Step 3: 增加迁移和共享类型**

在 `MIGRATIONS` 末尾加入两条幂等建表语句：

```ts
`CREATE TABLE IF NOT EXISTS development_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  codex_thread_id TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('discussion', 'development')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);`,
`CREATE TABLE IF NOT EXISTS development_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES development_sessions(id)
);`,
```

在 `development-types.ts` 定义：

```ts
export type DevelopmentPhase = 'discussion' | 'development';
export type DevelopmentRole = 'user' | 'assistant';

export interface DevelopmentMessage {
  id: string;
  sessionId: string;
  role: DevelopmentRole;
  content: string;
  createdAt: string;
}

export interface DevelopmentSession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  codexThreadId: string | null;
  phase: DevelopmentPhase;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentSessionDetail extends DevelopmentSession {
  messages: DevelopmentMessage[];
}
```

- [x] **Step 4: 实现最小仓储**

实现以下签名，SQL 全部使用参数绑定：

```ts
export class DevelopmentRepository {
  constructor(private readonly database: DatabaseSync) {}

  createSession(session: Omit<DevelopmentSession, 'projectName' | 'codexThreadId'>): void;
  listSessions(): DevelopmentSession[];
  getSession(id: string): DevelopmentSessionDetail | null;
  addMessage(message: DevelopmentMessage): void;
  saveThreadId(id: string, threadId: string, updatedAt: string): void;
  updateTitle(id: string, title: string, updatedAt: string): void;
  updatePhase(id: string, phase: DevelopmentPhase, updatedAt: string): void;
}
```

`listSessions` 和 `getSession` 使用 `JOIN projects` 取得 `project_name`，会话按 `updated_at DESC` 排序，消息按 `created_at ASC, id ASC` 排序。`addMessage` 在同一事务内插入消息并把会话 `updated_at` 更新为消息时间。`connection.ts` 在迁移前执行 `PRAGMA foreign_keys = ON;`。

- [x] **Step 5: 运行仓储测试确认 GREEN**

Run: `npm run build && node --test dist-electron/tests/development-repository.test.js`

Expected: 1 test passed, 0 failed。

- [x] **Step 6: 提交数据层**

```bash
git add electron/database/migrations.ts electron/database/connection.ts electron/development/development-types.ts electron/development/development-repository.ts electron/tests/development-repository.test.ts
git commit -m "feat: persist AI development sessions"
```

---

### Task 2: Codex JSONL 解析与安全子进程控制器

**Files:**
- Create: `electron/development/codex-event-parser.ts`
- Create: `electron/development/codex-controller.ts`
- Modify: `electron/development/development-types.ts`
- Test: `electron/tests/codex-event-parser.test.ts`
- Test: `electron/tests/codex-controller.test.ts`

**Interfaces:**
- Consumes: 本机 `codex.cmd`、项目绝对路径、可选 thread ID、prompt、sandbox。
- Produces: `DevelopmentEvent` 流和 `CodexController.run()` / `stop()`。

- [x] **Step 1: 写 JSONL 解析失败测试**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCodexJsonLine } from '../development/codex-event-parser.js';

test('解析 Codex 的 thread、AI、命令和文件变化事件', () => {
  assert.deepEqual(
    parseCodexJsonLine('{"type":"thread.started","thread_id":"thread-1"}'),
    { type: 'thread-started', threadId: 'thread-1' },
  );
  assert.deepEqual(
    parseCodexJsonLine('{"type":"item.completed","item":{"id":"m1","type":"agent_message","text":"完成"}}'),
    { type: 'assistant-message', text: '完成' },
  );
  assert.deepEqual(
    parseCodexJsonLine('{"type":"item.started","item":{"id":"c1","type":"command_execution","command":"npm test"}}'),
    { type: 'command-started', id: 'c1', command: 'npm test' },
  );
  assert.deepEqual(
    parseCodexJsonLine('{"type":"item.completed","item":{"id":"f1","type":"file_change","changes":[{"path":"src/app.tsx"}]}}'),
    { type: 'file-change', paths: ['src/app.tsx'] },
  );
});

test('损坏 JSONL 转成日志且不抛错', () => {
  assert.deepEqual(parseCodexJsonLine('not-json'), { type: 'log', text: 'not-json' });
});
```

- [x] **Step 2: 运行解析测试确认 RED**

Run: `npm run build`

Expected: TypeScript 失败，提示找不到 `codex-event-parser.js`。

- [x] **Step 3: 实现稳定事件解析器**

在 `development-types.ts` 增加：

```ts
export type DevelopmentEvent =
  | { type: 'thread-started'; threadId: string }
  | { type: 'turn-started' }
  | { type: 'assistant-message'; text: string }
  | { type: 'command-started'; id: string; command: string }
  | { type: 'command-completed'; id: string; command: string; output: string; exitCode: number | null }
  | { type: 'file-change'; paths: string[] }
  | { type: 'turn-completed' }
  | { type: 'run-error'; message: string }
  | { type: 'log'; text: string }
  | { type: 'process-exited'; exitCode: number; stopped: boolean };
```

`parseCodexJsonLine(line)` 映射规格中的事件；命令输出使用 `output.slice(-4000)`；未知合法事件返回 `{ type: 'log', text: line }`。

- [x] **Step 4: 写控制器失败测试**

用假的 `spawn` 记录参数并发出 JSONL，断言权限和恢复参数：

```ts
test('讨论使用 read-only，恢复开发使用 workspace-write', async () => {
  const invocations: string[][] = [];
  const controller = new CodexController({
    spawn: (_command, args) => {
      invocations.push(args);
      return fakeCodexProcess([
        '{"type":"thread.started","thread_id":"thread-1"}',
        '{"type":"turn.completed"}',
      ]);
    },
  });

  await controller.run({ projectPath: 'C:\\project', prompt: '讨论需求', sandbox: 'read-only' });
  await controller.run({ projectPath: 'C:\\project', threadId: 'thread-1', prompt: '开始开发', sandbox: 'workspace-write' });

  assert.ok(invocations[0]?.includes('read-only'));
  assert.deepEqual(invocations[1]?.slice(-3), ['--skip-git-repo-check', 'thread-1', '-']);
  assert.ok(invocations[1]?.includes('workspace-write'));
  assert.ok(invocations.flat().every((item) => item !== 'danger-full-access'));
});
```

- [x] **Step 5: 运行控制器测试确认 RED**

Run: `npm run build`

Expected: TypeScript 失败，提示找不到 `codex-controller.js`。

- [x] **Step 6: 实现最小控制器**

控制器公开：

```ts
export interface CodexRunRequest {
  projectPath: string;
  threadId?: string;
  prompt: string;
  sandbox: 'read-only' | 'workspace-write';
}

export class CodexController {
  constructor(dependencies?: { spawn?: SpawnCodexProcess; terminate?: (pid: number) => Promise<void> });
  subscribe(listener: (event: DevelopmentEvent) => void): () => void;
  run(request: CodexRunRequest): Promise<void>;
  stop(): Promise<void>;
  get isRunning(): boolean;
}
```

首次调用参数：

```ts
['-C', projectPath, '-s', sandbox, '-a', 'never', 'exec', '--json', '--skip-git-repo-check', '-']
```

恢复调用参数：

```ts
['-C', projectPath, '-s', sandbox, '-a', 'never', 'exec', 'resume', '--json', '--skip-git-repo-check', threadId, '-']
```

Windows 默认命令使用 `codex.cmd`，`spawn` 配置为 `{ cwd: projectPath, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }`。停止时执行 `taskkill /PID <pid> /T /F`，并等待原进程退出。

- [x] **Step 7: 运行解析器和控制器测试确认 GREEN**

Run: `npm run build && node --test dist-electron/tests/codex-event-parser.test.js dist-electron/tests/codex-controller.test.js`

Expected: 所有测试通过，参数中不存在危险权限标志。

- [x] **Step 8: 提交 Codex 运行层**

```bash
git add electron/development/codex-event-parser.ts electron/development/codex-controller.ts electron/development/development-types.ts electron/tests/codex-event-parser.test.ts electron/tests/codex-controller.test.ts
git commit -m "feat: run Codex safely for project development"
```

---

### Task 3: 开发服务、IPC 与 preload 白名单

**Files:**
- Create: `electron/development/development-service.ts`
- Create: `electron/development/development-handlers.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Test: `electron/tests/development-service.test.ts`
- Test: `electron/tests/development-ipc.test.ts`

**Interfaces:**
- Consumes: `ProjectRepository`、`DevelopmentRepository`、`CodexController`。
- Produces: `development:*` IPC 请求和 `development:event` 推送。

- [x] **Step 1: 写服务失败测试**

```ts
test('讨论保存用户与 AI 消息并保存 thread id', async () => {
  const events: DevelopmentEvent[] = [];
  const fixture = developmentServiceFixture(events);
  const created = fixture.service.createSession('project-1');

  const run = fixture.service.sendMessage(created.id, '先分析项目结构');
  fixture.controller.emit({ type: 'thread-started', threadId: 'thread-1' });
  fixture.controller.emit({ type: 'assistant-message', text: '结构分析完成' });
  fixture.controller.finish();
  await run;

  const saved = fixture.repository.getSession(created.id);
  assert.equal(saved?.codexThreadId, 'thread-1');
  assert.deepEqual(saved?.messages.map((item) => item.content), ['先分析项目结构', '结构分析完成']);
  assert.equal(fixture.controller.requests[0]?.sandbox, 'read-only');
});

test('开始开发切换 phase 并使用 workspace-write', async () => {
  const fixture = developmentServiceFixture([]);
  fixture.seedDiscussionWithThread('session-1', 'thread-1');
  const run = fixture.service.startDevelopment('session-1');
  fixture.controller.emit({ type: 'turn-started' });
  fixture.controller.finish();
  await run;
  assert.equal(fixture.repository.getSession('session-1')?.phase, 'development');
  assert.equal(fixture.controller.requests[0]?.sandbox, 'workspace-write');
});
```

- [x] **Step 2: 运行服务测试确认 RED**

Run: `npm run build`

Expected: TypeScript 失败，提示找不到 `development-service.js`。

- [x] **Step 3: 实现服务业务规则**

公开签名：

```ts
export class DevelopmentService {
  constructor(
    projectRepository: ProjectRepository,
    developmentRepository: DevelopmentRepository,
    controller: CodexController,
    publish: (sessionId: string, event: DevelopmentEvent) => void,
  );

  listSessions(): DevelopmentSession[];
  getSession(id: string): DevelopmentSessionDetail;
  createSession(projectId: string): DevelopmentSessionDetail;
  sendMessage(sessionId: string, text: string): Promise<void>;
  startDevelopment(sessionId: string): Promise<void>;
  stop(sessionId: string): Promise<void>;
  dispose(): Promise<void>;
}
```

实现规则：

- `createSession` 校验项目存在且目录存在；标题初始为项目名；
- 首条用户消息将标题更新为去空格后的前 22 个字符；
- `sendMessage` 在 discussion 使用 `read-only`，在 development 使用 `workspace-write`；
- `startDevelopment` 必须已有 thread，prompt 固定为“需求已经确认。请根据以上对话开始实施，遵循项目现有规范，完成后运行必要检查并汇报结果。”；收到该次运行的 `turn-started` 后再把 phase 更新为 development；
- controller 活动时任何新 run 返回“已有 AI 任务正在运行”；
- controller 事件附加当前 session ID 后 publish；
- thread 和 AI 消息落库；
- 项目路径不存在返回“项目目录不存在”。

- [x] **Step 4: 写 IPC 失败测试**

```ts
test('开发 IPC 注册请求通道并向窗口转发事件', async () => {
  const registered = new Map<string, (...args: unknown[]) => unknown>();
  const sent: unknown[][] = [];
  registerDevelopmentIpcHandlers(service, { handle: (channel, handler) => registered.set(channel, handler) });

  assert.ok(registered.has('development:list-sessions'));
  assert.ok(registered.has('development:send-message'));
  sendDevelopmentEvent({ send: (...args) => sent.push(args) }, 'session-1', { type: 'turn-started' });
  assert.deepEqual(sent[0], ['development:event', { sessionId: 'session-1', event: { type: 'turn-started' } }]);
});
```

- [x] **Step 5: 实现 IPC、main 和 preload**

注册通道：

```ts
development:list-sessions
development:get-session
development:create-session
development:send-message
development:start
development:stop
```

事件载荷：

```ts
export interface DevelopmentEventEnvelope {
  sessionId: string;
  event: DevelopmentEvent;
}
```

preload 白名单：

```ts
listDevelopmentSessions(): Promise<DevelopmentSession[]>;
getDevelopmentSession(id: string): Promise<DevelopmentSessionDetail>;
createDevelopmentSession(projectId: string): Promise<DevelopmentSessionDetail>;
sendDevelopmentMessage(sessionId: string, message: string): Promise<void>;
startDevelopment(sessionId: string): Promise<void>;
stopDevelopment(sessionId: string): Promise<void>;
subscribeDevelopmentEvents(listener: (envelope: DevelopmentEventEnvelope) => void): () => void;
```

`main.ts` 创建唯一 `CodexController` 和 `DevelopmentService`，使用主窗口 `webContents.send` 发布事件。将主窗口保存到模块变量，窗口关闭后置空。

具体退出流程使用 `before-quit` 防止异步清理被跳过：第一次收到退出事件时 `preventDefault()`，设置 `shutdownStarted = true`，等待 `developmentService.dispose()` 和数据库关闭完成后再次调用 `app.quit()`；第二次事件因 guard 已设置而直接放行。

- [x] **Step 6: 运行服务和 IPC 测试确认 GREEN**

Run: `npm run build && node --test dist-electron/tests/development-service.test.js dist-electron/tests/development-ipc.test.js`

Expected: 所有服务和 IPC 测试通过。

- [x] **Step 7: 提交主进程闭环**

```bash
git add electron/development electron/main.ts electron/preload.ts src/vite-env.d.ts electron/tests/development-service.test.ts electron/tests/development-ipc.test.ts
git commit -m "feat: expose real AI development IPC"
```

---

### Task 4: React 会话数据接入与项目选择

**Files:**
- Create: `src/features/project-development/project-development-api.ts`
- Modify: `src/features/project-development/project-development-types.ts`
- Modify: `src/features/project-development/project-development-page.tsx`
- Modify: `src/features/project-development/development-session-list.tsx`
- Modify: `src/features/project-development/development-chat-panel.tsx`
- Modify: `src/features/project-development/development-run-panel.tsx`
- Modify: `src/features/project-development/project-development.css`

**Interfaces:**
- Consumes: Task 3 的 preload API 和 `listProjects({ status: 'all' })`。
- Produces: 持久化会话、真实消息、真实运行状态和项目选择交互。

- [x] **Step 1: 替换渲染进程类型**

将模拟类型替换为：

```ts
export type DevelopmentPhase = 'discussion' | 'development';
export type DevelopmentRunStatus = 'idle' | 'running' | 'completed' | 'error' | 'stopped';

export interface DevelopmentSession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  codexThreadId: string | null;
  phase: DevelopmentPhase;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentRunView {
  status: DevelopmentRunStatus;
  startedAt: number | null;
  commandCount: number;
  changedPaths: string[];
  currentAction: string;
  logs: Array<{ id: string; label: string; detail?: string }>;
}
```

- [x] **Step 2: 创建唯一 API 模块**

`project-development-api.ts` 只封装 `window.desktopApi`：

```ts
export const listSessions = () => window.desktopApi.listDevelopmentSessions();
export const getSession = (id: string) => window.desktopApi.getDevelopmentSession(id);
export const createSession = (projectId: string) => window.desktopApi.createDevelopmentSession(projectId);
export const sendMessage = (id: string, text: string) => window.desktopApi.sendDevelopmentMessage(id, text);
export const startDevelopment = (id: string) => window.desktopApi.startDevelopment(id);
export const stopDevelopment = (id: string) => window.desktopApi.stopDevelopment(id);
export const subscribeDevelopmentEvents = (listener: (event: DevelopmentEventEnvelope) => void) =>
  window.desktopApi.subscribeDevelopmentEvents(listener);
```

- [x] **Step 3: 替换页面模拟状态**

删除 `RUN_STEPS`、`setInterval` 和模拟 AI 回复。页面挂载时并行加载会话和全部项目；创建会话时显示内联项目选择器，没有项目则提供“先去项目管理创建项目”的提示。

页面状态限定为：

```ts
const [sessions, setSessions] = useState<DevelopmentSession[]>([]);
const [activeSession, setActiveSession] = useState<DevelopmentSessionDetail | null>(null);
const [projects, setProjects] = useState<Project[]>([]);
const [run, setRun] = useState<DevelopmentRunView>(emptyRun);
const [error, setError] = useState('');
```

收到匹配 `activeSession.id` 的事件才更新右栏；`assistant-message` 事件后重新调用 `getSession` 取得已落库消息；收到 `process-exited` 后刷新会话列表和当前会话。

- [x] **Step 4: 调整三栏组件**

- 左栏副标题显示 `projectName · phase`，底部改为“本机 Codex · 工作区权限受限”；
- 中栏顶部显示项目名和 `需求讨论` / `开发执行`；
- discussion 阶段显示“开始开发”，development 阶段隐藏该按钮；
- 运行中禁用发送；
- 空消息提示改为“先与 AI 讨论需求，确认前不会修改项目文件”；
- 右栏删除进度条和百分比，展示状态、耗时、命令数、变更文件数和最多 100 条日志；
- `command-completed` 展开时展示裁剪后的输出；
- 错误用文字和颜色共同表达。

- [x] **Step 5: 构建确认类型闭环**

Run: `npm run build`

Expected: React、preload、Electron 主进程全部编译成功，无 TypeScript 错误。

- [x] **Step 6: 提交真实工作台**

```bash
git add src/features/project-development src/vite-env.d.ts
git commit -m "feat: connect project development workspace to Codex"
```

---

### Task 5: 全量验证、文档更新与安全检查

**Files:**
- Modify: `README.md`
- Modify: `docs/project-development-workbench-design.md`
- Modify: `docs/superpowers/plans/2026-08-30-real-project-development.md`

**Interfaces:**
- Consumes: Tasks 1-4 的完整闭环。
- Produces: 可交付的验证证据和使用说明。

- [ ] **Step 1: 更新 README 使用说明**

写明：

```markdown
## 真实 AI 项目开发

1. 安装并登录 Codex CLI：`codex login`；
2. 在项目管理中创建或登记项目；
3. 在“项目开发”中新建会话并选择项目；
4. 讨论阶段为只读，点击“开始开发”后才允许写入项目目录；
5. 运行期间可在右侧查看命令和文件变化，或点击停止。
```

将旧设计文档顶部标记为“模拟版历史设计，已由真实模式规格替代”，并链接新规格。

- [ ] **Step 2: 运行全量自动化测试**

Run: `npm test`

Expected: 所有 database、service、validation、Codex、development 测试通过，0 failed。

- [ ] **Step 3: 运行独立生产构建**

Run: `npm run build`

Expected: Vite 与 Electron TypeScript 构建成功。

- [ ] **Step 4: 检查危险参数和模拟残留**

Run:

```powershell
rg -n "danger-full-access|dangerously-bypass|RUN_STEPS|模拟回复|模拟执行器" electron src
```

Expected: 无结果；如果测试需要包含危险字符串来断言禁止项，只允许出现在测试断言中，不允许出现在生产文件。

- [ ] **Step 5: 检查 Git 差异**

Run: `git diff --check && git status --short`

Expected: 无空白错误，仅显示本任务预期文档修改。

- [ ] **Step 6: 提交验证与文档**

```bash
git add README.md docs/project-development-workbench-design.md docs/superpowers/plans/2026-08-30-real-project-development.md
git commit -m "docs: document real AI development workflow"
```

- [ ] **Step 7: 推送主分支**

```bash
git push origin main
```

Expected: 本地 `main` 与 `origin/main` 同步。
