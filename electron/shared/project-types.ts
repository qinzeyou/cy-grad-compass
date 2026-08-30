// 中文注释：主进程与 preload 共享的项目领域类型。渲染进程有独立类型定义，
// 避免渲染进程反向依赖主进程模块，保持进程边界清晰。

export const PROJECT_STATUSES = ['in-progress', 'completed', 'archived'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectStatusFilter = 'all' | ProjectStatus;

export interface Project {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecentProject {
  id: string;
  name: string;
  status: ProjectStatus;
  path: string;
  createdAt: string;
}

// 中文注释：统计接口的返回结构，直接由数据库查询结果聚合而成，不维护独立统计缓存。
export interface ProjectStatistics {
  total: number;
  inProgress: number;
  completed: number;
  archived: number;
  recentProjects: RecentProject[];
}

export interface ProjectListQuery {
  keyword?: string;
  status?: ProjectStatusFilter;
}

// 中文注释：创建项目时渲染进程只提供名称与目标目录，具体路径由主进程计算并校验。
export interface ProjectCreateInput {
  name: string;
  targetDirectory: string;
}

// 中文注释：更新项目时名称与状态至少提供一项；名称只改记录不改目录，
// 避免主进程替用户移动其自行维护的代码目录。
export interface ProjectUpdateInput {
  id: string;
  name?: string;
  status?: ProjectStatus;
}

// 中文注释：状态/名称修改成功后附带最新统计，渲染进程无需二次请求即可刷新卡片。
export interface ProjectUpdateResult {
  project: Project;
  statistics: ProjectStatistics;
}

// 中文注释：模板记录，对应 templates 表。storedPath 是应用数据目录内的模板副本路径。
export interface Template {
  id: string;
  name: string;
  storedPath: string;
  createdAt: string;
  updatedAt: string;
}

// 中文注释：首版只管理一个模板来源，模板记录使用固定 id，替换时原地更新。
export const DEFAULT_TEMPLATE_ID = 'default';

// 中文注释：项目名称去除首尾空格后的长度上限，与《项目开发与管理功能开发文档》一致。
export const PROJECT_NAME_MAX_LENGTH = 80;

// 中文注释：生成项目时临时目录的前缀，临时目录位于最终项目目录旁，复制完成后再改名。
export const PROJECT_TEMP_PREFIX = '.gc-tmp-';
