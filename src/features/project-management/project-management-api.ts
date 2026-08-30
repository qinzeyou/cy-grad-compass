// 中文注释：调用 preload 白名单 API 的唯一模块，页面组件不直接触碰 window.desktopApi 之外的任何能力。

import type { Project } from '../project-statistics/project-statistics-types';
import type {
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectUpdateResult,
  Template,
} from './project-management-types';

export function fetchTemplate(): Promise<Template | null> {
  return window.desktopApi.getTemplate();
}

// 中文注释：用户取消目录选择时返回 null，与导入/替换通道的约定一致。
export function importTemplate(): Promise<Template | null> {
  return window.desktopApi.importTemplate();
}

export function replaceTemplate(): Promise<Template | null> {
  return window.desktopApi.replaceTemplate();
}

export function createProject(input: ProjectCreateInput): Promise<Project> {
  return window.desktopApi.createProject(input);
}

export function updateProject(input: ProjectUpdateInput): Promise<ProjectUpdateResult> {
  return window.desktopApi.updateProject(input);
}

// 中文注释：按记录 id 打开项目目录，主进程会先确认记录存在。
export function openProjectPath(id: string): Promise<void> {
  return window.desktopApi.openProjectPath(id);
}

export function selectDirectory(): Promise<string | null> {
  return window.desktopApi.selectDirectory();
}
