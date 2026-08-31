# DeepSeek 设置与仪表盘清空 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `cy-grad-compass` 中新增 DeepSeek 配置与连通性测试设置页，并将仪表盘改为空状态页。

**Architecture:** 主进程通过独立 `userData/ai-config.json` 保存配置，DeepSeek HTTP 请求只在主进程执行；preload 暴露三个白名单 IPC 方法，React 设置页负责表单交互。仪表盘保留路由和菜单，仅移除页面数据查询与展示内容。

**Tech Stack:** Electron、React、TypeScript、Ant Design、Node.js `fs/promises`、原生 `fetch`、现有 Node test runner。

**Spec:** `docs/superpowers/specs/2026-08-31-deepseek-settings-dashboard-design.md`

## Global Constraints

- Provider 固定为 `deepseek`。
- 默认模型为 `deepseek-chat`。
- 默认 API 地址为 `https://api.deepseek.com`。
- API Key 不得回传渲染进程、写入日志或出现在错误信息中。
- 保持 `contextIsolation: true` 和 `nodeIntegration: false`。
- 仪表盘保留菜单入口，页面显示空状态，不删除统计数据库能力。
- 本期不接入项目开发执行链路，不新增多 Provider、云同步或知识库功能。

---

### Task 1: 建立 AI 配置类型与文件仓储

**Files:**
- Create: `electron/ai/ai-types.ts`
- Create: `electron/ai/config-repository.ts`
- Test: `electron/tests/ai-config-repository.test.ts`

**Interfaces:**
- Produces `StoredAiConfig`、`AiConfigDto`、`AiProviderName`、`readAiConfig(userDataPath)`、`writeAiConfig(userDataPath, config)`、`toAiConfigDto(config)`。

- [ ] **Step 1: 写配置仓储失败测试**

测试至少覆盖：文件不存在返回默认值、损坏 JSON 回退、写入后读取一致、DTO 只返回 `hasApiKey`。

```ts
assert.equal((await readAiConfig(tempDir)).model, 'deepseek-chat');
assert.equal(toAiConfigDto(config).hasApiKey, true);
assert.equal('apiKey' in toAiConfigDto(config), false);
```

- [ ] **Step 2: 运行单测确认失败**

Run: `npm run build; node --test "dist-electron/tests/ai-config-repository.test.js"`

Expected: FAIL，因为 AI 类型和仓储尚未存在。

- [ ] **Step 3: 实现最小文件仓储**

使用 `node:fs/promises` 和 `path.join(userDataPath, 'ai-config.json')`；读取异常回退默认值；写入前创建目录，文件权限使用用户可读写模式；DTO 只返回 `hasApiKey`。

- [ ] **Step 4: 运行单测确认通过**

Run: `npm run build; node --test "dist-electron/tests/ai-config-repository.test.js"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add electron/ai/ai-types.ts electron/ai/config-repository.ts electron/tests/ai-config-repository.test.ts
git commit -m "feat: add ai config repository"
```

### Task 2: 实现 DeepSeek 测试连接服务

**Files:**
- Create: `electron/ai/deepseek-provider.ts`
- Test: `electron/tests/deepseek-provider.test.ts`

**Interfaces:**
- Consumes `AiProviderConfig` 或等价的完整配置类型。
- Produces `testDeepSeekConnection(config): Promise<AiConnectionResult>`。

- [ ] **Step 1: 写失败测试**

覆盖成功响应、配置错误、超时、HTTP 非 2xx、非 JSON、缺少 `choices[0].message.content`，并断言请求使用 `/chat/completions`、Bearer Key 和 `stream: false`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build; node --test "dist-electron/tests/deepseek-provider.test.js"`

Expected: FAIL，因为服务函数尚未存在。

- [ ] **Step 3: 写最小实现**

使用原生 `fetch`、`AbortController` 和定时器；请求失败按 `AI_CONFIG`、`AI_TIMEOUT`、`AI_HTTP`、`AI_RESPONSE`、`AI_NETWORK` 分类；错误文本截断并替换完整 API Key。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run build; node --test "dist-electron/tests/deepseek-provider.test.js"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add electron/ai/deepseek-provider.ts electron/tests/deepseek-provider.test.ts
git commit -m "feat: add deepseek connection test"
```

### Task 3: 接入主进程 IPC 与 preload 白名单

**Files:**
- Create: `electron/ipc/ai-handlers.ts`
- Modify: `electron/main.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Test: `electron/tests/ai-handlers.test.ts`

**Interfaces:**
- Produces `desktopApi.getAiConfig()`、`desktopApi.saveAiConfig(input)`、`desktopApi.testAiConnection()`。
- Registers `ai:get-config`、`ai:save-config`、`ai:test-connection`。

- [ ] **Step 1: 写 IPC 行为测试**

覆盖保存入参校验、空 Key 保留旧值、`get` 不泄露 Key、`test` 使用已保存配置。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build; node --test "dist-electron/tests/ai-handlers.test.js"`

Expected: FAIL，因为通道和 preload API 尚未注册。

- [ ] **Step 3: 实现 handler 和桥接**

主进程注册 handler，复用现有错误包装约定；`main.ts` 只调用注册函数；preload 只增加三个函数，不暴露 `ipcRenderer` 或完整配置对象。

- [ ] **Step 4: 运行构建和测试**

Run: `npm run build; node --test "dist-electron/tests/ai-handlers.test.js"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add electron/ipc/ai-handlers.ts electron/main.ts electron/preload.ts src/vite-env.d.ts electron/tests/ai-handlers.test.ts
git commit -m "feat: expose ai settings ipc"
```

### Task 4: 新增设置菜单和 AI 设置页

**Files:**
- Create: `src/features/settings/settings-page.tsx`
- Create: `src/features/settings/ai-settings-panel.tsx`
- Create: `src/features/settings/settings-api.ts`
- Create: `src/features/settings/settings-types.ts`
- Modify: `src/app.tsx`
- Modify: `src/styles.css`
- Test: `electron/tests/settings-page.test.tsx` 或项目现有等价渲染测试目录

**Interfaces:**
- Consumes `window.desktopApi.getAiConfig/saveAiConfig/testAiConnection`。
- Produces设置页表单、保存反馈、测试连接反馈和 `settings` 导航状态。

- [ ] **Step 1: 写渲染测试**

覆盖设置菜单可见、默认字段、保存成功后清空 Key 输入框、未配置 Key 时测试按钮禁用、连接成功/失败提示。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build; node --test "dist-electron/tests/settings-page.test.js"`

Expected: FAIL，因为设置菜单和组件尚未存在。

- [ ] **Step 3: 实现最小页面**

使用 Ant Design `Form`、`Input.Password`、`Button`、`Alert`；Provider 固定 DeepSeek；独立管理读取、保存、测试 loading；不在表单中回显真实 Key。

- [ ] **Step 4: 运行构建和测试**

Run: `npm run build; node --test "dist-electron/tests/settings-page.test.js"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/settings src/app.tsx src/styles.css electron/tests/settings-page.test.tsx
git commit -m "feat: add deepseek settings page"
```

### Task 5: 清空仪表盘页面内容

**Files:**
- Modify: `src/features/project-statistics/project-statistics-page.tsx`
- Test: `electron/tests/project-statistics-page.test.tsx` 或项目现有等价渲染测试目录

**Interfaces:**
- 保持 `ProjectStatisticsPage` 导出名称，避免 `App` 产生无关路由改动。
- 不改变 `project:get-statistics` IPC 和统计数据结构。

- [ ] **Step 1: 写失败测试**

断言仪表盘显示空状态文案，且挂载页面时不调用 `getProjectStatistics`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run build; node --test "dist-electron/tests/project-statistics-page.test.js"`

Expected: FAIL，因为当前页面仍加载并展示统计内容。

- [ ] **Step 3: 替换为占位页面**

删除页面内部统计查询、卡片、最近项目和快速开始组合；保留组件导出与菜单切换所需接口，渲染单一空状态。

- [ ] **Step 4: 运行构建和测试**

Run: `npm run build; node --test "dist-electron/tests/project-statistics-page.test.js"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/project-statistics/project-statistics-page.tsx electron/tests/project-statistics-page.test.tsx
git commit -m "refactor: clear dashboard content"
```

### Task 6: 全量验证与文档核对

**Files:**
- Verify: `docs/superpowers/specs/2026-08-31-deepseek-settings-dashboard-design.md`
- Verify: `docs/superpowers/plans/2026-08-31-deepseek-settings-dashboard.md`

- [ ] **Step 1: 运行完整构建和测试**

Run: `npm run build; npm test`

Expected: 构建成功，既有测试和新增测试全部通过。

- [ ] **Step 2: 做一次手工验收**

确认四项：设置菜单可打开、配置重启后保留、Key 不回显、仪表盘只有空状态且不触发统计查询。

- [ ] **Step 3: 检查范围**

确认没有新增项目开发 AI 执行、没有新增数据库迁移、没有提交构建产物或无关格式化。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-08-31-deepseek-settings-dashboard-design.md docs/superpowers/plans/2026-08-31-deepseek-settings-dashboard.md
git commit -m "docs: plan deepseek settings and dashboard cleanup"
```
