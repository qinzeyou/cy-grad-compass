# 真实 AI 项目开发模式设计

## 1. 目标

将现有“项目开发”模拟工作台接入本机 Codex CLI，使用户可以选择一个已管理项目，通过对话澄清需求，确认后让 AI 在该项目目录内完成开发，并在右侧查看真实运行事件。

本设计只实现单机、单用户、单个主 Agent 和单个活动任务。多 Agent、云端 API、模型选择和跨设备同步均不属于本次范围。

## 2. 已确认技术方案

使用本机 `codex exec --json`，不接入实验性的 Codex app-server，也不要求用户输入 OpenAI API Key。Codex CLI 复用用户现有登录状态。

官方 OpenAI 文档说明，`codex exec --json` 会输出 JSONL 事件，包括 `thread.started`、`turn.*`、`item.*` 和 `error`，其中 item 可表示 AI 消息、命令执行和文件变更：

<https://developers.openai.com/codex/non-interactive-mode>

本机已验证版本为 `codex-cli 0.149.1`。

## 3. 用户流程

1. 用户进入“项目开发”；
2. 点击“新建会话”，选择一个项目管理中的已有项目；
3. 用户发送消息，与 AI 讨论需求；
4. 讨论阶段 Codex 只能读取项目，不能修改文件；
5. 用户点击“开始开发”；
6. 应用恢复同一 Codex thread，并允许在项目目录内写入；
7. 中间栏显示真实 AI 回复；
8. 右侧显示真实命令、文件变更、错误和运行耗时；
9. 用户可停止当前运行；
10. 运行结束后可继续发送补充要求，后续消息保持开发权限。

应用不自动提交 Git、不自动推送远程仓库，也不允许 Codex 写入所选项目目录之外的位置。

## 4. 两阶段权限模型

### 4.1 需求讨论阶段

首次消息：

```text
codex -C <project-path> -s read-only -a never \
  exec --json --skip-git-repo-check -
```

后续讨论：

```text
codex -C <project-path> -s read-only -a never \
  exec resume --json --skip-git-repo-check <thread-id> -
```

用户消息通过 stdin 发送。`read-only` 允许 AI 阅读项目并给出建议，但阻止文件修改。

### 4.2 开发阶段

用户点击“开始开发”后，应用向同一 thread 发送明确指令，并切换沙箱：

```text
codex -C <project-path> -s workspace-write -a never \
  exec resume --json --skip-git-repo-check <thread-id> -
```

`workspace-write` 只允许项目工作区内写入。禁止使用 `danger-full-access` 和 `--dangerously-bypass-approvals-and-sandbox`。

后续补充消息继续使用 `workspace-write`。命令若需要项目目录之外的权限将失败，并由 AI 或界面向用户说明。

## 5. 数据模型

在现有 SQLite 数据库增加：

```sql
CREATE TABLE development_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  codex_thread_id TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('discussion', 'development')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE development_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES development_sessions(id)
);
```

会话和消息持久化，应用重启后仍可恢复对话。右侧命令日志和文件变更只保留当前运行的内存数据，重启后清空。

数据库不持久化 `running` 状态。应用启动后没有活动子进程，所有历史会话均显示为“空闲”。

## 6. 主进程模块

```text
electron/development/
  codex-controller.ts
  codex-event-parser.ts
  development-repository.ts
  development-service.ts
  development-handlers.ts
  development-types.ts
```

### 6.1 `codex-controller.ts`

- 使用 `child_process.spawn` 启动 `codex.cmd`；
- 同一时间只允许一个活动子进程；
- prompt 写入 stdin 后关闭 stdin；
- stdout 按行解析 JSONL；
- stderr 转为可见日志和错误；
- Windows 停止使用系统 `taskkill /PID <pid> /T /F` 终止进程树；
- 进程退出后清理活动引用。

### 6.2 `codex-event-parser.ts`

将 Codex JSONL 映射为稳定的应用事件：

```ts
type DevelopmentEvent =
  | { type: 'thread-started'; threadId: string }
  | { type: 'turn-started' }
  | { type: 'assistant-message'; text: string }
  | { type: 'command-started'; id: string; command: string }
  | { type: 'command-completed'; id: string; command: string; output: string; exitCode: number | null }
  | { type: 'file-change'; paths: string[] }
  | { type: 'turn-completed' }
  | { type: 'run-error'; message: string }
  | { type: 'process-exited'; exitCode: number; stopped: boolean };
```

未知事件只追加为调试日志，不让解析器崩溃。命令输出在传给渲染进程前限制为最后 4000 个字符。

### 6.3 `development-service.ts`

- 校验会话、项目和项目路径；
- 创建会话并保存消息；
- 根据 phase 构造 read-only 或 workspace-write 调用；
- 收到 `thread-started` 后保存 `codex_thread_id`；
- 收到 AI 消息后保存到消息表；
- “开始开发”要求已有 thread 且当前 phase 为 discussion；
- 开发启动成功后将 phase 更新为 development；
- 将运行事件发布到创建请求的渲染窗口。

## 7. IPC 接口

请求接口：

```ts
development:list-sessions(): Promise<DevelopmentSession[]>;
development:get-session(sessionId: string): Promise<DevelopmentSessionDetail>;
development:create-session(projectId: string): Promise<DevelopmentSessionDetail>;
development:send-message(sessionId: string, message: string): Promise<void>;
development:start(sessionId: string): Promise<void>;
development:stop(sessionId: string): Promise<void>;
```

事件接口：

```ts
development:event
```

preload 暴露 `subscribeDevelopmentEvents(listener)`，返回取消订阅函数。渲染进程不得接触 `ipcRenderer`、进程对象或 Codex CLI 参数。

## 8. 渲染进程调整

沿用现有三栏组件，移除模拟定时器：

- 左栏从 SQLite 读取真实会话，并显示关联项目；
- 新建会话时显示项目选择；
- 中间栏加载持久化消息；
- 讨论阶段显示“开始开发”；
- 开发阶段发送按钮直接将补充要求交给 Codex；
- 右栏按真实事件构建运行视图；
- 删除虚构进度百分比，改为状态、耗时、命令数、变更文件数和事件日志；
- 当前运行期间禁止切换到另一个会话启动任务，但允许浏览历史消息。

运行事件最多保留 100 条，防止长任务无限占用渲染进程内存。

## 9. 状态规则

```text
idle → running → completed
idle → running → error
idle → running → stopped
```

- `thread.started`：保存 thread ID；
- `turn.started`：进入运行中；
- `turn.completed`：进入完成；
- `turn.failed`、`error` 或非零退出：进入错误；
- 用户停止：进入已停止；
- 非当前 session 的事件不得更新当前右栏。

“完成”表示本次 Codex turn 已结束，不代表项目满足所有业务验收。

## 10. 错误处理

- 找不到 `codex.cmd`：提示安装 Codex CLI；
- 未登录或认证失败：提示在终端执行 `codex login`；
- 项目记录不存在：阻止启动；
- 项目路径不存在：提示先修复项目目录；
- 已有运行：提示等待或停止当前任务；
- JSONL 单行解析失败：记录原始行，继续处理后续事件；
- 进程异常退出：保留已收到的对话和日志；
- 停止失败：显示错误，仍监听进程实际退出；
- 应用退出：先终止活动 Codex 进程树，再关闭数据库。

## 11. 测试

使用现有 Node.js `node:test`，不新增测试框架。

必须覆盖：

1. 初次讨论调用使用 `read-only`；
2. 开始开发和开发阶段消息使用 `workspace-write`；
3. 调用参数不包含危险全权限标志；
4. JSONL 正确解析 AI 消息、命令、文件变化和错误；
5. 未知或损坏 JSONL 不会中断后续事件；
6. thread ID 和 AI 消息写入 SQLite；
7. 同时启动第二个任务被拒绝；
8. stop 会终止活动进程并产生 stopped 状态；
9. 非当前会话事件不会污染右栏；
10. 现有项目管理、模板管理和统计测试继续通过。

## 12. 验收标准

- 可以从已管理项目创建开发会话；
- 讨论阶段 AI 能真实回复且不能修改文件；
- 点击“开始开发”后 Codex 能在项目目录写入；
- AI 回复、命令、文件变更和错误实时出现在正确区域；
- 用户可以停止运行，停止后不再接收新的命令事件；
- 应用重启后会话、消息和 Codex thread ID 仍存在；
- 后续消息可以恢复原 Codex thread；
- 任意调用都不使用危险全权限模式；
- `npm test` 和 `npm run build` 通过。

## 13. 明确后置

- 多 Agent 和子 Agent 明细；
- Codex app-server；
- OpenAI API Key 配置；
- 模型与推理强度选择；
- 代码 diff 审阅器；
- 自动 Git commit/push/PR；
- 多任务并发；
- 右侧运行日志跨重启持久化。
