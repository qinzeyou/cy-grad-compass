# 项目开发三栏工作台设计说明

## 1. 首版边界

首版只实现项目开发工作台的界面和模拟运行状态，不连接 ChatGPT/Codex，不读取或修改项目目录，不执行本地命令，不需要 API Key。

页面沿用 ChatGPT 类对话体验，提供三栏布局：左侧开发会话列表，中间用户与 AI 对话面板，右侧 AI 运行情况面板。

## 2. 页面布局

```text
┌──────────────┬──────────────────────────────┬──────────────────┐
│ 开发会话列表 │ 对话标题 / 消息 / 输入框      │ AI 运行情况       │
│ 新建会话     │ 用户消息、AI 消息、确认按钮   │ 状态、进度、日志   │
└──────────────┴──────────────────────────────┴──────────────────┘
```

- 左栏宽度 250px，显示会话标题、更新时间和当前状态；
- 中栏自适应，占据主要空间；
- 右栏宽度 300px，显示模拟 Agent、当前动作、进度和事件日志；
- 窄窗口下三栏仍可滚动，首版不改为复杂响应式抽屉。

## 3. 用户流程

1. 用户点击左侧“项目开发”；
2. 页面默认创建一个空开发会话；
3. 用户输入需求并发送；
4. 页面追加用户消息，延迟约 700ms 后追加模拟 AI 回复；
5. 用户点击“开始开发”；
6. 右侧依次模拟 `排队 → 分析需求 → 编写代码 → 运行检查 → 已完成`；
7. 用户可点击“停止运行”，状态变为“已停止”；
8. 用户点击“新建会话”后，创建独立的空对话。

模拟 AI 回复必须明确标注“模拟回复”，避免用户误以为已经调用真实模型。

## 4. 前端数据模型

```ts
type ChatRole = 'user' | 'assistant';
type RunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'stopped';

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type DevelopmentSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  run: {
    status: RunStatus;
    progress: number;
    currentAction: string;
    logs: string[];
  };
};
```

状态仅保存在 React 内存中，刷新应用后清空是首版的明确行为。

## 5. 模拟运行逻辑

- 点击开始时，将状态设为 `queued`，进度 5%；
- 通过一个定时器每 900ms 推进一个动作和进度；
- 动作顺序固定为：`分析需求`、`编写代码`、`运行检查`、`整理结果`；
- 最后进入 `completed`，进度 100%；
- 停止时清理定时器，状态变为 `stopped`，追加“用户停止了本次模拟运行”；
- 运行中禁用开始按钮，空闲、完成和停止状态允许再次开始；
- 切换会话前清理当前会话的定时器引用，避免后台更新错误会话。

## 6. 组件拆分

```text
src/features/project-development/
  project-development-page.tsx
  development-session-list.tsx
  development-chat-panel.tsx
  development-run-panel.tsx
  project-development-types.ts
  project-development.css
```

- `project-development-page.tsx`：维护会话数组、当前会话和模拟运行状态；
- `development-session-list.tsx`：会话列表、新建会话和切换；
- `development-chat-panel.tsx`：消息渲染、输入框、发送和开始开发；
- `development-run-panel.tsx`：状态摘要、进度条和模拟日志；
- `project-development-types.ts`：共享类型；
- `project-development.css`：仅维护本功能样式，避免继续膨胀全局样式文件。

## 7. 交互和可访问性

- 输入框支持 `Enter` 发送，`Shift + Enter` 换行；
- 所有按钮有明确中文名称；
- 运行状态同时使用文字和颜色，不依赖颜色单独表达；
- 会话列表使用按钮，当前会话提供 `aria-current`；
- 消息区和日志区可独立滚动；
- 无消息时显示清晰的空状态和示例提示。

## 8. 非目标

首版不实现真实 ChatGPT、Codex、OpenAI API、IPC、SQLite 会话持久化、文件读写、命令执行、代码 diff、流式输出和多 Agent 调度。

## 9. 验收标准

- 左侧可以新建并切换多个会话；
- 中间可以发送消息并看到模拟 AI 回复；
- 右侧可以看到模拟状态、进度和日志变化；
- 点击停止后不会继续推进进度；
- 切换会话后消息和运行状态互不串线；
- 页面不影响现有仪表盘、项目管理和模板管理菜单；
- `npm run build` 通过。
