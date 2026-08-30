// 中文注释：渲染进程侧的项目统计类型，与主进程 IPC 返回结构保持一致，
// 页面只依赖这里的类型，不感知数据库表结构。

export const PROJECT_STATUSES = ['in-progress', 'completed', 'archived'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectStatusFilter = 'all' | ProjectStatus;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  'in-progress': '进行中',
  completed: '已完成',
  archived: '已归档',
};

export const PROJECT_FILTER_LABELS: Record<ProjectStatusFilter, string> = {
  all: '全部',
  'in-progress': '进行中',
  completed: '已完成',
  archived: '已归档',
};

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

export interface ProjectUpdateResult {
  project: Project;
  statistics: ProjectStatistics;
}
