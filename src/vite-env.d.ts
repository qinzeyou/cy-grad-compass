/// <reference types="vite/client" />

import type {
  Project,
  ProjectListQuery,
  ProjectStatistics,
  ProjectStatus,
  ProjectUpdateResult,
} from './features/project-statistics/project-statistics-types';
import type {
  ProjectCreateInput,
  ProjectUpdateInput,
  Template,
} from './features/project-management/project-management-types';
import type {
  DevelopmentEventEnvelope,
  DevelopmentSession,
  DevelopmentSessionDetail,
} from './features/project-development/project-development-types';

declare global {
  interface Window {
    // 中文注释：渲染进程访问 preload 暴露的白名单桌面 API。
    desktopApi: {
      getAppVersion: () => Promise<string>;
      openPath: (path: string) => Promise<string>;
      minimizeWindow: () => Promise<void>;
      toggleMaximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      selectDirectory: () => Promise<string | null>;
      getProjectStatistics: () => Promise<ProjectStatistics>;
      listProjects: (query: ProjectListQuery) => Promise<Project[]>;
      updateProjectStatus: (id: string, status: ProjectStatus) => Promise<ProjectUpdateResult>;
      updateProject: (input: ProjectUpdateInput) => Promise<ProjectUpdateResult>;
      createProject: (input: ProjectCreateInput) => Promise<Project>;
      openProjectPath: (id: string) => Promise<void>;
      getTemplate: () => Promise<Template | null>;
      importTemplate: () => Promise<Template | null>;
      replaceTemplate: () => Promise<Template | null>;
      listDevelopmentSessions: () => Promise<DevelopmentSession[]>;
      getDevelopmentSession: (id: string) => Promise<DevelopmentSessionDetail>;
      createDevelopmentSession: (projectId: string) => Promise<DevelopmentSessionDetail>;
      sendDevelopmentMessage: (sessionId: string, message: string) => Promise<void>;
      startDevelopment: (sessionId: string) => Promise<void>;
      stopDevelopment: (sessionId: string) => Promise<void>;
      subscribeDevelopmentEvents: (listener: (envelope: DevelopmentEventEnvelope) => void) => () => void;
    };
  }
}

export {};
