# WeFlow HTTP Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 启动当前项目时可复用或自动启动 WeFlow，通过本机 HTTP API 读取微信会话与消息，并继续使用当前项目的成单分析与收益台账。

**Architecture:** 主进程新增 WeFlow Bridge，负责检测/启动 WeFlow、健康检查、会话与消息请求；订单服务通过 Bridge 读取数据，不再直接调用受保护 WCDB DLL。渲染进程只配置 WeFlow 可执行文件、API 地址、Token 和自动启动开关。

**Tech Stack:** Electron main process, Node.js `child_process`/`fetch`, React/Ant Design, SQLite JSON order repository.

**Spec:** 用户确认的“WeFlow 后台运行 + HTTP API 读取微信记录”方案。

## Global Constraints

- WeFlow 默认本机地址为 `http://127.0.0.1:5031`。
- 所有 `/api/v1/*` 请求使用 `Authorization: Bearer <token>`。
- 当前项目继续按备注名前缀和指定会话筛选。
- 当前项目不绕过 WeFlow 原生保护，不直接修改受保护 DLL。

### Task 1: WeFlow Bridge 核心

**Files:**
- Create: `electron/weflow/weflow-types.ts`
- Create: `electron/weflow/weflow-config.ts`
- Create: `electron/weflow/weflow-bridge.ts`
- Test: `electron/tests/weflow-bridge.test.ts`

**Interfaces:**
- `WeFlowConfig`: `executablePath`, `baseUrl`, `apiToken`, `autoStart`。
- `WeFlowBridge.health(): Promise<boolean>`。
- `WeFlowBridge.ensureRunning(config): Promise<void>`。
- `WeFlowBridge.listSessions(): Promise<WechatSession[]>`。
- `WeFlowBridge.listMessages(sessionId, limit): Promise<WechatMessage[]>`。

- [x] 写失败测试：健康检查失败且 `autoStart=false` 时返回可读错误；API 响应映射为现有消息类型。
- [x] 运行 `npm run build` 和定向 Node 测试确认失败原因。
- [x] 使用 `fetch`、`spawn` 和健康轮询实现最小 Bridge。
- [x] 运行定向测试确认通过。

### Task 2: 配置与 IPC

**Files:**
- Modify: `electron/wechat/wechat-config.ts`
- Modify: `electron/wechat/wechat-types.ts`
- Modify: `electron/ipc/wechat-handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/features/settings/wechat-settings-panel.tsx`
- Test: `electron/tests/wechat-config.test.ts`

**Interfaces:**
- 配置新增 WeFlow 字段并保持旧 WCDB 字段可读取。
- 新增 `wechat:test-weflow`，返回健康检查结果。

- [x] 将配置安全写入 userData，并在 DTO 中隐藏 Token。
- [x] 设置页增加 WeFlow 路径、API 地址、Token、自动启动字段。
- [x] 构建并运行设置相关测试。

### Task 3: 订单服务切换数据源

**Files:**
- Modify: `electron/orders/order-service.ts`
- Modify: `electron/main.ts`
- Modify: `electron/ipc/order-handlers.ts`
- Modify: `src/features/order-analysis/order-analysis-page.tsx`

- [x] `OrderService.analyze()` 默认使用 WeFlow Bridge；仅显式启用旧版监听时保留 WCDB 兼容实现。
- [x] 应用启动恢复 WeFlow 连接，退出时不强制结束 WeFlow。
- [x] 通过轮询触发订单刷新。
- [x] 保留已有候选、确认成单、续单、退款和维护记录行为。

### Task 4: 全量验证

**Files:**
- Modify: `src/test/desktop-api-mock.ts`
- Test: `src/features/settings/wechat-settings-panel.test.tsx`

- [x] 运行 `npm test`。
- [x] 检查 `git diff`，确认没有覆盖用户既有改动。
- [x] 记录真实连接前需要填写的 WeFlow API Token 和端口。

## 使用说明

1. 在 WeFlow 中完成微信数据库连接，并开启 HTTP API 服务（默认 `http://127.0.0.1:5031`）。
2. 从 WeFlow 设置复制 Access Token，在本项目“设置 → 微信数据源”填写 API 地址和 Token。
3. 如需本项目自动启动 WeFlow，填写 WeFlow 源码目录并勾选“应用启动时自动启动 WeFlow”；项目会自动安装缺失依赖并执行 `npm run dev`。
4. 保存后点击“测试 WeFlow 连接”，再在“成单分析”中分析消息。
