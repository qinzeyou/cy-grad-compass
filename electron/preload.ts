// 中文注释：preload 只向渲染进程暴露白名单能力，避免直接暴露 ipcRenderer 和 Node.js。
// 通道名称与主进程 handler 一一对应，具体业务校验全部在主进程完成。
import { contextBridge, ipcRenderer } from 'electron';
import type {
  Project,
  ProjectCreateInput,
  ProjectListQuery,
  ProjectStatistics,
  ProjectUpdateInput,
  ProjectUpdateResult,
  Template,
} from './shared/project-types.js';
import type {
  DevelopmentEventEnvelope,
  DevelopmentSession,
  DevelopmentSessionDetail,
} from './development/development-types.js';

// 中文注释：Electron 会把主进程抛出的错误包装成
// "Error invoking remote method '<通道>': Error: <消息>"，这里还原成只含中文消息的
// 普通错误，渲染进程可以直接展示 message，不用解析包装前缀。
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args).then(
    (data) => data as T,
    (error: unknown) => {
      if (error instanceof Error && error.message.startsWith('Error invoking remote method')) {
        const match = error.message.match(/Error: ([\s\S]*)$/);
        throw new Error(match !== null ? match[1] : error.message);
      }
      throw error;
    },
  );
}

contextBridge.exposeInMainWorld('desktopApi', {
  // 系统能力
  getAppVersion: (): Promise<string> => invoke('system:get-app-version'),
  openPath: (path: string): Promise<string> => invoke('system:open-path', path),
  minimizeWindow: (): Promise<void> => invoke('window:minimize'),
  toggleMaximizeWindow: (): Promise<boolean> => invoke('window:toggle-maximize'),
  closeWindow: (): Promise<void> => invoke('window:close'),
  isMaximized: (): Promise<boolean> => invoke('window:is-maximized'),

  // 项目统计
  getProjectStatistics: (): Promise<ProjectStatistics> => invoke('project:get-statistics'),
  listProjects: (query: ProjectListQuery): Promise<Project[]> => invoke('project:list', query),

  // 项目管理
  createProject: (input: ProjectCreateInput): Promise<Project> => invoke('project:create', input),
  updateProject: (input: ProjectUpdateInput): Promise<ProjectUpdateResult> =>
    invoke('project:update', input),
  // 中文注释：只改状态的便捷方法，内部复用 project:update 通道。
  updateProjectStatus: (id: string, status: Project['status']): Promise<ProjectUpdateResult> =>
    invoke('project:update', { id, status }),
  openProjectPath: (id: string): Promise<void> => invoke('project:open-path', id),
  selectDirectory: (): Promise<string | null> => invoke('dialog:select-directory'),

  // 模板管理
  getTemplate: (): Promise<Template | null> => invoke('template:get'),
  importTemplate: (): Promise<Template | null> => invoke('template:import'),
  replaceTemplate: (): Promise<Template | null> => invoke('template:replace'),

  // 开发会话
  listDevelopmentSessions: (): Promise<DevelopmentSession[]> => invoke('development:list-sessions'),
  getDevelopmentSession: (id: string): Promise<DevelopmentSessionDetail> => invoke('development:get-session', id),
  createDevelopmentSession: (projectId: string): Promise<DevelopmentSessionDetail> => invoke('development:create-session', projectId),
  sendDevelopmentMessage: (sessionId: string, message: string): Promise<void> => invoke('development:send-message', sessionId, message),
  startDevelopment: (sessionId: string): Promise<void> => invoke('development:start', sessionId),
  stopDevelopment: (sessionId: string): Promise<void> => invoke('development:stop', sessionId),
  subscribeDevelopmentEvents: (listener: (envelope: DevelopmentEventEnvelope) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, envelope: DevelopmentEventEnvelope) => listener(envelope);
    ipcRenderer.on('development:event', handler);
    return () => ipcRenderer.off('development:event', handler);
  },
});
