# 项目统计功能开发文档

## 1. 功能定位

项目统计用于快速回答三个问题：当前有多少项目、项目处于什么状态、最近创建了哪些项目。统计数据必须直接来自本地 SQLite 的 `projects` 表，不维护独立的统计缓存。

本功能服务于单机单用户 MVP，不包含登录、跨设备同步、复杂报表设计和在线协作。

## 2. MVP 范围

### 2.1 统计指标

首页展示四个统计卡片：

| 指标 | 规则 |
|---|---|
| 项目总数 | 所有项目记录数量 |
| 进行中 | `status = 'in-progress'` |
| 已完成 | `status = 'completed'` |
| 已归档 | `status = 'archived'` |

同时展示最近 5 个项目，按 `created_at` 倒序排列。

### 2.2 项目列表筛选

项目管理页复用同一数据源，支持：

- 按项目名称搜索，忽略首尾空格；
- 按状态筛选；
- 清空筛选并恢复全部项目；
- 显示无数据、无匹配结果和加载失败状态。

统计卡片点击后可跳转到项目管理页，并自动带入对应状态筛选。首版不增加图表库，数字卡片和列表足够覆盖当前需求。

## 3. 数据模型

统计只依赖项目表：

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('in-progress', 'completed', 'archived')),
  template_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

时间保存为 ISO 8601 字符串。项目创建、状态修改和归档成功后，主进程向渲染进程返回最新统计，避免页面继续显示旧数据。

## 4. 主进程接口

### 4.1 查询统计

IPC 通道：`project:get-statistics`

请求：无参数。

返回：

```ts
type ProjectStatistics = {
  total: number;
  inProgress: number;
  completed: number;
  archived: number;
  recentProjects: Array<{
    id: string;
    name: string;
    status: 'in-progress' | 'completed' | 'archived';
    path: string;
    createdAt: string;
  }>;
};
```

### 4.2 查询项目列表

IPC 通道：`project:list`

请求：

```ts
type ProjectListQuery = {
  keyword?: string;
  status?: 'all' | 'in-progress' | 'completed' | 'archived';
};
```

返回：按 `updated_at` 倒序排列的项目数组。

### 4.3 统计查询原则

- `COUNT(*)` 获取总数和状态数量；
- `ORDER BY created_at DESC LIMIT 5` 获取最近项目；
- 所有查询使用参数绑定，不拼接用户输入；
- 数据库异常统一转换为可读错误，渲染进程显示“统计加载失败”，不吞掉异常。

## 5. React 模块拆分

建议目录：

```text
src/features/project-statistics/
  project-statistics-page.tsx
  project-statistics-card.tsx
  recent-project-list.tsx
  project-statistics-api.ts
  project-statistics-types.ts
```

职责边界：

- `project-statistics-page.tsx`：加载统计数据、管理加载/错误状态和跳转筛选；
- `project-statistics-card.tsx`：只负责单张指标卡片展示；
- `recent-project-list.tsx`：展示最近项目和空状态；
- `project-statistics-api.ts`：调用 preload 暴露的 IPC 方法；
- `project-statistics-types.ts`：集中定义返回数据类型。

页面组件不得直接导入 `electron`、`fs` 或数据库驱动。

## 6. 状态与交互

1. 页面进入时显示轻量加载状态；
2. 查询成功后渲染四张卡片和最近项目；
3. 项目列表或状态发生变化后重新查询统计；
4. 没有项目时显示空状态和“导入模板/新建项目”入口；
5. 查询失败时显示错误文本和“重新加载”按钮；
6. 项目路径失效不影响数字统计，打开路径时单独提示失败。

## 7. 验收标准

- 项目总数等于项目列表记录数；
- 三种状态数量之和等于项目总数；
- 修改项目状态后，统计卡片刷新为最新数量；
- 最近项目最多显示 5 条且按创建时间倒序；
- 搜索和状态筛选结果准确，清空后恢复全部项目；
- 空数据库、无匹配结果和数据库异常都有明确界面状态；
- 应用重启后统计结果与数据库内容一致。

## 8. 测试清单

至少覆盖以下可自动验证行为：

1. 空数据库返回四个 0 和空的最近项目；
2. 插入三种状态的项目后，统计数量正确；
3. 最近项目只返回 5 条并保持倒序；
4. 关键字查询只匹配项目名称；
5. 非法状态不会写入数据库；
6. 数据库查询失败时 IPC 返回错误，页面进入错误状态。

## 9. 明确后置

按专业、指导教师、年份的维度统计、饼图/柱状图、CSV/Excel 导出、时间趋势和自定义报表均后置，除非实际使用中证明数字卡片和列表不足。
