# 项目开发与管理功能开发文档

## 1. 功能定位

本功能负责管理一个本地代码模板，并基于模板复制生成毕业设计项目。生成后的项目记录可查看、搜索、筛选、修改状态和打开目录。

首版只管理一个模板来源，但数据模型保留 `template_id`，避免后续改成多模板时重做项目表。模板导入采用“复制到应用数据目录”，生成项目采用“用户选择目标目录后复制”，不修改代码、不安装依赖、不初始化 Git。

## 2. 用户流程

### 2.1 导入模板

1. 用户点击“导入代码模板”；
2. Electron 打开目录选择器；
3. 用户选择已完成的本地项目目录；
4. 应用读取目录名称作为默认模板名称；
5. 应用将目录复制到 `app.getPath('userData')/templates/default`；
6. 写入或更新 `templates` 表；
7. 页面显示模板名称、导入时间和存储路径。

如果已有模板，必须二次确认后才能替换。替换先复制到临时目录，复制完整后再原子替换旧模板，失败时保留旧模板。

### 2.2 生成项目

1. 用户点击“新建项目”；
2. 页面检查模板是否已导入；
3. 用户填写项目名称并选择目标目录；
4. 应用将模板目录复制为目标目录下的项目目录；
5. 复制成功后写入 `projects` 表；
6. 页面刷新项目列表和统计。

项目名称只用于目录名和列表展示，首版不替换模板内文件内容。目标目录已存在同名目录时直接阻止操作，不覆盖任何已有文件。

### 2.3 管理项目

项目开发页内的项目管理视图支持：

- 查看项目名称、状态、路径、创建时间和更新时间；
- 按名称搜索；
- 按状态筛选；
- 修改项目名称；
- 将状态改为“进行中”“已完成”或“已归档”；
- 在系统文件管理器中打开项目目录；
- 选择“进入开发”后打开该项目的 AI 工作台；
- 归档项目。

侧边栏不提供独立“项目管理”菜单。仪表盘统计卡片、“查看全部”和“新建项目”都进入“项目开发”的项目管理视图；只有选择具体项目后才能进入 AI 开发视图。

删除项目记录不是 MVP 必需能力。项目代码目录由用户选择和维护，应用默认不删除用户目录。

## 3. 数据模型

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stored_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('in-progress', 'completed', 'archived')),
  template_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES templates(id)
);
```

字段说明：

- `stored_path` 是应用内部模板副本路径；
- `path` 是用户选择的生成项目路径；
- `template_id` 用于追溯项目由哪个模板生成；
- 时间统一保存 ISO 8601 字符串。

## 4. Electron 主进程接口

### 4.1 模板接口

```ts
template:import(): Promise<Template>;
template:get(): Promise<Template | null>;
template:replace(): Promise<Template>;
```

`template:import` 和 `template:replace` 在主进程执行目录选择、路径校验、复制和数据库写入。渲染进程不能传入任意目标存储路径。

### 4.2 项目接口

```ts
project:create(input: {
  name: string;
  targetDirectory: string;
}): Promise<Project>;

project:list(query: {
  keyword?: string;
  status?: 'all' | 'in-progress' | 'completed' | 'archived';
}): Promise<Project[]>;

project:update(input: {
  id: string;
  name?: string;
  status?: 'in-progress' | 'completed' | 'archived';
}): Promise<Project>;

project:open-path(id: string): Promise<void>;
```

所有通道都由 preload 以白名单函数暴露，禁止暴露完整 `ipcRenderer`。

## 5. 主进程模块拆分

建议目录：

```text
electron/
  main.ts
  preload.ts
  database/
    connection.ts
    migrations.ts
    template-repository.ts
    project-repository.ts
  services/
    template-service.ts
    project-service.ts
  ipc/
    template-handlers.ts
    project-handlers.ts
  shared/
    project-types.ts
```

职责边界：

- repository 只负责 SQL 和数据映射；
- service 负责输入校验、目录复制、事务和业务错误；
- IPC handler 只负责接收请求并调用 service；
- `main.ts` 只负责应用生命周期和注册 handler。

单个文件超过 250 行时必须按上述职责继续拆分。

## 6. 路径与输入校验

- 模板源路径必须存在且为目录；
- 模板内部目录复制到应用数据目录，不接受渲染进程提供的内部存储路径；
- 项目名称不能为空，去除首尾空格后长度限制为 1-80 个字符；
- 项目名称不得包含 Windows/macOS/Linux 不允许的路径字符；
- 目标目录必须存在且可写；
- 目标目录下若存在同名项目目录，返回“项目目录已存在”，不覆盖；
- `path` 写入数据库前使用绝对路径；
- 打开路径前检查记录存在，使用 `shell.openPath`，失败时返回系统错误文本。

## 7. 复制与事务规则

目录复制采用 Node.js `fs.cp`。为了避免半成品：

1. 先复制到目标目录旁的临时目录；
2. 复制成功后重命名为最终项目目录；
3. 再写入项目数据库记录；
4. 数据库写入失败时删除刚生成的目录；
5. 任一步失败都保留原模板和已有项目，不覆盖用户目录。

模板替换同理，旧模板只有在新模板复制成功后才切换。

## 8. React 模块拆分

建议目录：

```text
src/features/project-management/
  project-management-page.tsx
  project-list.tsx
  project-row.tsx
  project-form.tsx
  template-panel.tsx
  project-management-api.ts
  project-management-types.ts
```

组件职责：

- `template-panel.tsx`：显示模板状态、导入和替换入口；
- `project-form.tsx`：收集项目名称和目标目录选择结果；
- `project-list.tsx`：搜索、筛选和列表空状态；
- `project-row.tsx`：单项目展示和状态操作；
- `project-development-page.tsx`：组合项目管理视图与 AI 工作台，并保存当前选中的项目；
- 页面组件负责组合区域和刷新数据，不直接处理文件系统。

## 9. 错误与用户反馈

必须区分以下错误：

- 未导入模板：提示先导入模板；
- 源目录不存在：提示重新选择；
- 目标目录不可写：提示更换目录；
- 项目目录重复：提示更换项目名称或目标目录；
- 复制中断：提示生成失败且未覆盖原目录；
- 数据库写入失败：提示记录未保存，并清理新目录；
- 项目路径失效：允许保留记录，但打开目录时提示路径不存在。

所有异步操作都要有加载状态，按钮在操作期间禁用，避免重复导入或重复生成。

## 10. 验收标准

- 导入模板后，删除原始模板目录仍能生成项目；
- 重新导入模板不会破坏已有项目记录；
- 生成项目时只复制目录，不修改模板文件；
- 目标目录存在同名项目时不会覆盖；
- 生成成功后项目立即出现在列表和统计中；
- 应用重启后模板和项目记录仍存在；
- 状态修改后可被统计功能正确汇总；
- 打开项目目录可以唤起系统文件管理器；
- 侧边栏没有独立项目管理菜单，项目必须从项目开发页选择后才能进入 AI 工作台；
- 复制失败时原模板和已有项目不受影响。

## 11. 测试清单

至少覆盖以下行为：

1. 导入目录后模板副本存在；
2. 删除源目录后仍可读取模板副本；
3. 空名称、非法名称和重复项目目录被拒绝；
4. 生成项目会复制嵌套文件和隐藏文件；
5. 复制失败时不产生项目记录；
6. 数据库写入失败时清理临时项目目录；
7. 三种状态均可保存，非法状态被拒绝；
8. 搜索、筛选、重命名和打开路径行为正确。

## 12. 明确后置

模板内占位符替换、依赖安装、Git 初始化、多模板市场、项目删除、附件管理、学生/教师详细字段和远程仓库同步均不属于本功能首版范围。
