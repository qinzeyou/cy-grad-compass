# 毕业设计指南针

单机单用户的毕业设计代码项目生成与管理工具，基于 Electron + React 构建。

## 当前 MVP

- 导入一个本地代码模板，并复制到应用模板库；
- 基于模板复制生成项目，目标目录由用户选择；
- 管理项目名称、路径和状态；
- 查看项目总数、进行中、已完成、已归档统计；
- 项目开发统一包含项目管理入口和三栏 AI 工作台；
- Word 项目说明书、复杂字段、任务管理和多模板能力暂不包含在首版。

## 开发环境

- Node.js 22+
- npm 10+
- Windows / macOS / Linux

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run test   # 构建后运行数据库层自动化测试
npm run seed   # 写入演示项目数据（便于验证统计与列表）
npm run smoke  # 冒烟验证：启动窗口检查 preload/IPC/统计是否正常
npm start
```

## 目录结构

```text
electron/       Electron 主进程与 preload
src/            React 渲染进程
docs/           项目规范与设计文档
```

## 数据与安全边界

Electron 主进程负责本地文件系统和数据库；React 通过 preload 的白名单 API 访问桌面能力。渲染进程关闭 Node.js 集成，避免页面直接读写本地文件。

## 真实 AI 项目开发

1. 在终端执行 `codex login` 完成 Codex 登录；
2. 在“项目开发”的项目管理视图中创建项目；
3. 从项目列表点击“进入开发”，再新建开发会话；
4. 讨论阶段使用只读权限，点击“开始开发”后才允许写入项目目录；
5. 运行期间可在右侧查看命令和文件变化，或点击停止。

## 命名说明

文件名、目录名和 npm 脚本名使用 `kebab-case`（多个单词使用 `-` 分隔）。TypeScript/React 标识符必须遵循语言语法，使用 `camelCase` 或 `PascalCase`，这是对“多单词用 `-`”要求的必要技术例外。
