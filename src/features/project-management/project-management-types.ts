// 中文注释：项目管理页使用的渲染进程侧类型，与主进程 IPC 结构保持一致。
// 状态相关类型复用项目统计模块的定义，避免两处维护同一枚举。

import type { Project, ProjectStatistics } from '../project-statistics/project-statistics-types';

// 中文注释：模板记录，对应 templates 表。
export interface Template {
  id: string;
  name: string;
  storedPath: string;
  createdAt: string;
  updatedAt: string;
}

// 中文注释：创建项目的输入，与 project:create 通道一致。
export interface ProjectCreateInput {
  name: string;
  targetDirectory: string;
}

// 中文注释：更新项目的输入，名称与状态至少提供一项。
export interface ProjectUpdateInput {
  id: string;
  name?: string;
  status?: Project['status'];
}

// 中文注释：更新成功后返回最新项目与统计，页面无需二次请求。
export interface ProjectUpdateResult {
  project: Project;
  statistics: ProjectStatistics;
}
