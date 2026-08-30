import type {
  Project,
  ProjectListQuery,
  ProjectStatistics,
  ProjectStatus,
  ProjectUpdateResult,
} from './project-statistics-types';

// 中文注释：调用 preload 白名单 API 的唯一模块，页面组件不直接触碰 window.desktopApi 之外的任何能力。
export function fetchProjectStatistics(): Promise<ProjectStatistics> {
  return window.desktopApi.getProjectStatistics();
}

export function fetchProjectList(query: ProjectListQuery = {}): Promise<Project[]> {
  return window.desktopApi.listProjects(query);
}

export function changeProjectStatus(id: string, status: ProjectStatus): Promise<ProjectUpdateResult> {
  return window.desktopApi.updateProject({ id, status });
}
