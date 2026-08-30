# 毕业设计指南针 MVP 基础框架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建可运行的单机 Electron + React MVP 基础框架，并固化后续 AI 开发规范。

**Architecture:** Electron 主进程负责窗口与本地能力，preload 通过白名单 IPC 连接 React 渲染进程。MVP 数据和项目操作将在后续迭代接入本地 SQLite 与文件复制服务；本次先交付可运行工作区和导航/统计空状态。

**Tech Stack:** Electron, React, TypeScript, Vite, Node.js 22+, npm。

**Spec:** `docs/mvp-design.md`

## Global Constraints

- 所有新增代码必须写中文注释。
- 文件夹、文件和脚本使用 `kebab-case`；TypeScript 标识符使用语言合法的 `camelCase`/`PascalCase`。
- 单个文件原则上不超过 250 行。
- Electron 必须保持 `contextIsolation: true`、`nodeIntegration: false`。
- 每次提交前运行 `npm run build`。
- MVP 暂不实现 Word、登录、云同步、多人协作和多模板。

### Task 1: 项目规范与文档

**Files:**
- Create: `README.md`
- Create: `docs/development-standards.md`
- Create: `docs/mvp-design.md`

- [x] 写入运行方式、目录结构、安全边界和 MVP 后置范围。
- [x] 写入中文注释、模块化、命名和测试提交规范。

### Task 2: Electron + React 基础工程

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`
- Create: `electron/main.ts`, `electron/preload.ts`, `electron/tsconfig.json`
- Create: `src/main.tsx`, `src/app.tsx`, `src/styles.css`, `src/vite-env.d.ts`

- [x] 创建窗口与安全配置。
- [x] 创建 React 工作区首页、导航、统计空状态和快速开始区域。
- [x] 创建最小 IPC：读取应用版本、打开本地路径。

### Task 3: 构建验证与交付

- [ ] 执行 `npm install`。
- [ ] 执行 `npm run build`，确认 TypeScript 与 Vite 构建成功。
- [ ] 初始化 Git，提交规范、文档和基础框架。
- [ ] 推送到 `https://github.com/qinzeyou/cy-grad-compass.git`。
