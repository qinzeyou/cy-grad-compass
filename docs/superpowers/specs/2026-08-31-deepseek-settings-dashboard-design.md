# DeepSeek 设置与仪表盘清空设计说明

## 1. 背景与目标

`cy-grad-compass` 当前已有 Electron 主进程、preload 白名单 IPC、React + Ant Design 页面和 SQLite 项目数据。新需求只包含两个用户可见变化：

1. 新增“设置”菜单和 AI 设置页，完成 DeepSeek 配置、持久化和连通性测试；
2. 清空“仪表盘”页面内容，但保留菜单入口。

本期不把 DeepSeek 接入“项目开发”任务执行链路，不迁移 `cy-dev-trace` 的需求整理、知识库、总结等功能。

## 2. 参考实现结论

参考项目 `E:\code\2026\cy-dev-trace` 已验证以下边界可用，本项目按同一思路做最小移植：

- 配置文件放在 Electron `app.getPath('userData')` 下，而不是渲染进程或项目数据库；
- 主进程负责读取、写入、校验 API Key，并发起 DeepSeek 请求；
- preload 只暴露固定的 `get/save/test` 方法；
- 设置页显示 Provider、模型、API 地址和密码框 API Key；
- 保存后只返回 `hasApiKey`，不把真实 Key 回传到渲染进程；
- 测试连接区分配置错误、超时、HTTP、网络和响应格式错误。

## 3. 方案与范围

### 3.1 采用方案

采用独立 JSON 配置文件：

```text
app.getPath('userData')/ai-config.json
```

理由：当前只有单用户、单 Provider、单份配置，独立文件不需要 SQLite 迁移；配置与业务数据生命周期不同，后续替换 Provider 时也不会影响项目表。

### 3.2 明确不做

- 不新增多 Provider 选择逻辑，Provider 固定为 `deepseek`；
- 不接入项目开发页的 Codex 会话或命令执行；
- 不迁移知识库配置、需求整理、总结生成等参考项目能力；
- 不做云端同步、账号体系、密钥托管服务或复杂加密方案；
- 不删除项目统计 IPC、repository 和数据库字段，仅停止仪表盘页面对它们的调用。

## 4. 用户流程

### 4.1 配置 AI

1. 用户点击左侧“设置”；
2. 页面读取已保存配置；
3. 用户填写或修改模型、API 地址和 API Key；
4. 用户点击“保存配置”；
5. 主进程校验并写入 `ai-config.json`；
6. 页面显示保存成功和“API Key 已配置”状态，真实 Key 不回显。

### 4.2 测试连接

1. 仅在已有 API Key 时启用“测试连接”；
2. 主进程读取完整配置，向 `${apiBaseUrl}/chat/completions` 发起最小非流式请求；
3. 页面显示成功耗时，或显示可读的错误码和错误信息；
4. 测试失败不修改已有配置，不影响项目管理和项目开发。

### 4.3 仪表盘

保留左侧“仪表盘”菜单和路由，进入后显示统一空状态，例如“仪表盘内容已移除”。页面不查询统计、不显示统计卡片、最近项目、快速开始或错误重试区域。

## 5. 数据结构与接口

### 5.1 主进程类型

建议新增 `electron/ai/ai-types.ts`：

```ts
export type AiProviderName = 'deepseek';

export interface StoredAiConfig {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  apiKey: string;
}

export interface AiConfigDto {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  hasApiKey: boolean;
}

export type AiConnectionResult =
  | { ok: true; provider: AiProviderName; model: string; elapsedMs: number }
  | { ok: false; code: 'AI_CONFIG' | 'AI_TIMEOUT' | 'AI_HTTP' | 'AI_RESPONSE' | 'AI_NETWORK'; message: string };
```

渲染进程可以复用同一 DTO 类型，或在 `src/features/settings/settings-types.ts` 做同名镜像；不得把 `apiKey` 放入渲染进程返回值。

### 5.2 IPC 通道

```ts
'ai:get-config'   -> Promise<AiConfigDto>
'ai:save-config'  -> Promise<AiConfigDto>
'ai:test-connection' -> Promise<AiConnectionResult>
```

保存入参：

```ts
interface AiSaveConfigInput {
  provider: 'deepseek';
  model: string;
  apiBaseUrl: string;
  apiKey?: string;
}
```

`apiKey` 省略或为空字符串时保留旧 Key；只有显式传入非空 Key 才替换。

### 5.3 默认值

```text
provider: deepseek
model: deepseek-chat
apiBaseUrl: https://api.deepseek.com
apiKey: 空
```

配置文件不存在、格式损坏或字段不合法时回退到默认值，并把 API Key 视为空；读取失败不应阻止应用启动。

## 6. 主进程实现边界

建议目录与职责：

```text
electron/
  ai/
    ai-types.ts              # DTO、存储类型、错误结果
    config-repository.ts     # userData/ai-config.json 读写
    deepseek-provider.ts     # HTTP 请求、响应解析、超时
  ipc/
    ai-handlers.ts           # IPC 入参校验与 service 调用
```

- `config-repository.ts` 不依赖 BrowserWindow，不发起网络请求；
- `deepseek-provider.ts` 只接收完整配置，不负责文件写入；
- `ai-handlers.ts` 负责注册三个通道，并调用现有 `invoke` 错误约定；
- `electron/main.ts` 只负责注册 `registerAiIpcHandlers`，不直接写 AI 业务逻辑；
- `electron/preload.ts` 只增加三个白名单函数；
- 保持 `contextIsolation: true` 和 `nodeIntegration: false`。

### 6.1 校验规则

主进程是唯一可信校验点：

- Provider 必须是 `deepseek`；
- 模型去除首尾空格后不能为空，建议限制不超过 100 字符；
- API 地址必须是合法 `http:` 或 `https:` URL；
- API Key 在保存新值时不能为空，建议限制不超过 500 字符；
- 不接受渲染进程传入配置文件路径；
- HTTP 错误信息必须截断并脱敏，禁止回传 API Key。

### 6.2 DeepSeek 请求

- URL：去除末尾 `/` 后拼接 `/chat/completions`；
- 方法：`POST`；
- Header：`Authorization: Bearer <apiKey>`、`Content-Type: application/json`；
- Body：使用当前模型、非流式 `stream: false`，发送最小测试消息；
- 默认超时：60 秒；
- 响应必须包含 `choices[0].message.content`，否则返回 `AI_RESPONSE`。

## 7. 渲染进程实现边界

建议新增：

```text
src/features/settings/
  settings-page.tsx       # 页面组合
  ai-settings-panel.tsx   # 表单、保存、测试连接
  settings-api.ts         # 调用 window.desktopApi 的薄封装
  settings-types.ts       # 表单值和 DTO 类型（如未复用主进程类型）
```

页面要求：

- `App` 的导航类型增加 `settings`，菜单增加“设置”；
- “设置”页默认展示 AI 服务卡片；
- Provider 使用只读 Select 或静态文本“DeepSeek”；
- API Key 使用 `Input.Password`；
- 读取、保存、测试分别有独立 loading 状态；
- 保存成功后清空 Key 输入框，避免在表单状态中长期保留；
- 测试连接按钮在未配置 Key 时禁用；
- 所有错误显示简体中文，并保留后端错误码便于排查。

## 8. 仪表盘清空规则

修改 `src/features/project-statistics/project-statistics-page.tsx`，将其改为无数据查询的占位页面。同步删除该页面对统计 API、统计卡片和最近项目组件的直接依赖；暂不删除以下文件，避免扩大范围：

```text
src/features/project-statistics/project-statistics-api.ts
src/features/project-statistics/project-statistics-types.ts
src/features/project-statistics/project-statistics-card.tsx
src/features/project-statistics/recent-project-list.tsx
electron/database/project-repository.ts 中的统计方法
```

如果 `App` 中仍有仪表盘跳转回项目管理的回调，只删除仪表盘页面使用的回调，不改项目管理本身。

## 9. 错误处理

| 场景 | 错误码 | 用户提示原则 |
|---|---|---|
| Provider、模型、地址、Key 不合法 | `AI_CONFIG` | 指出具体字段，不发起请求 |
| 请求超过超时 | `AI_TIMEOUT` | 提示检查网络、地址或服务状态 |
| DeepSeek 返回非 2xx | `AI_HTTP` | 显示状态码，正文脱敏并截断 |
| 返回结构不符合预期 | `AI_RESPONSE` | 提示服务响应格式异常 |
| DNS、连接或其他网络异常 | `AI_NETWORK` | 提示无法连接服务 |
| 配置文件读取失败 | 无需暴露底层异常 | 使用默认配置并允许用户重新保存 |

保存失败时不得覆盖旧配置；建议先写临时文件，再替换正式文件，至少保证写入失败时旧文件仍可读。

## 10. 验收标准

1. 左侧出现“设置”菜单，点击后可打开 AI 设置页；
2. 首次打开显示 DeepSeek、`deepseek-chat`、`https://api.deepseek.com` 默认值；
3. 保存配置后重启应用仍能读取模型和 API 地址；
4. API Key 不会出现在页面回显、返回 DTO、日志或错误信息中；
5. API Key 留空保存时，旧 Key 仍可用于测试；
6. 非法 Provider、空模型、非法协议地址在主进程被拒绝；
7. 测试连接成功显示成功状态和耗时，失败显示分类错误；
8. 仪表盘菜单仍存在，但页面不再显示原统计内容，也不触发统计查询；
9. 项目管理、项目开发和模板功能不受影响；
10. `npm run build` 通过，新增单元测试覆盖配置读写、校验和 DeepSeek 响应错误。

## 11. 测试清单

### 主进程

- 配置文件不存在时返回默认配置；
- 配置文件字段损坏时安全回退；
- 写入后读取结果一致；
- 保存空 Key 保留旧 Key；
- Provider、模型、URL 校验拒绝非法输入；
- 连接成功、超时、HTTP 错误、非 JSON 响应和缺少 choices 分别映射到预期错误码；
- 错误正文不包含 API Key。

### 渲染进程

- 设置菜单可切换到设置页；
- 表单能加载默认/已保存配置；
- 保存期间按钮禁用，成功后显示状态；
- 未配置 Key 时测试按钮禁用；
- 测试成功和失败均有可见反馈；
- 仪表盘只渲染空状态，不调用统计 API。

## 12. 后置事项

只有在明确需要 AI 实际业务能力时，再单独设计项目开发对话、提示词、流式输出、配额控制和多 Provider 抽象；本期不提前搭建这些扩展点。
