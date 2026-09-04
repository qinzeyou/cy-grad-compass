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
import type { AiConfigDto, AiConnectionResult, AiSaveConfigInput } from './ai/ai-types.js';
import type { DealCandidate, OrderRecord, RevenueSummary } from './orders/order-types.js';
import type { WechatConfigDto, WechatConnectionResult, WechatSession } from './wechat/wechat-types.js';
import type { WeFlowConfigDto, WeFlowConnectionResult } from './weflow/weflow-types.js';
import type { SkillDetail, SkillFeature, SkillFeatureDetail, SkillSummary } from './skills/skill-types.js';

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
  selectWorkspaceDirectory: (): Promise<string | null> => invoke('dialog:select-workspace-directory'),
  registerProjectDirectory: (path: string): Promise<Project> => invoke('project:register-directory', path),
  selectFile: (): Promise<string | null> => invoke('dialog:select-file'),

  // 模板管理
  getTemplate: (): Promise<Template | null> => invoke('template:get'),
  importTemplate: (): Promise<Template | null> => invoke('template:import'),
  replaceTemplate: (): Promise<Template | null> => invoke('template:replace'),

  // 开发会话
  listDevelopmentSessions: (): Promise<DevelopmentSession[]> => invoke('development:list-sessions'),
  getDevelopmentSession: (id: string): Promise<DevelopmentSessionDetail> => invoke('development:get-session', id),
  createDevelopmentSession: (projectId: string): Promise<DevelopmentSessionDetail> => invoke('development:create-session', projectId),
  sendDevelopmentMessage: (sessionId: string, message: string, mode?: 'discussion' | 'development' | 'feature-extraction', skillId?: string): Promise<void> => invoke('development:send-message', sessionId, message, mode, skillId),
  startDevelopment: (sessionId: string, skillId?: string): Promise<void> => invoke('development:start', sessionId, skillId),
  continueDevelopment: (sessionId: string): Promise<void> => invoke('development:continue', sessionId),
  pauseDevelopment: (sessionId: string): Promise<void> => invoke('development:pause', sessionId),
  stopDevelopment: (sessionId: string): Promise<void> => invoke('development:stop', sessionId),
  deleteDevelopmentSession: (sessionId: string): Promise<void> => invoke('development:delete-session', sessionId),
  deleteDevelopmentWorkspace: (projectId: string): Promise<void> => invoke('development:delete-workspace', projectId),
  listSkills: (): Promise<SkillSummary[]> => invoke('skill:list'),
  listSkillFeatures: (): Promise<SkillFeature[]> => invoke('skill:list-features'),
  getSkill: (id: string): Promise<SkillDetail> => invoke('skill:get', id),
  getSkillFeature: (id: string): Promise<SkillFeatureDetail> => invoke('skill:get-feature', id),
  importSkill: (sourcePath: string): Promise<SkillSummary> => invoke('skill:import', sourcePath),
  extractSkill: (input: { name: string; description?: string; instructions: string }): Promise<SkillSummary> => invoke('skill:extract', input),
  deleteSkill: (id: string): Promise<void> => invoke('skill:delete', id),
  deleteSkillFeature: (id: string): Promise<void> => invoke('skill:delete-feature', id),
  subscribeDevelopmentEvents: (listener: (envelope: DevelopmentEventEnvelope) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, envelope: DevelopmentEventEnvelope) => listener(envelope);
    ipcRenderer.on('development:event', handler);
    return () => ipcRenderer.off('development:event', handler);
  },

  // AI 设置
  getAiConfig: (): Promise<AiConfigDto> => invoke('ai:get-config'),
  saveAiConfig: (input: AiSaveConfigInput): Promise<AiConfigDto> => invoke('ai:save-config', input),
  testAiConnection: (): Promise<AiConnectionResult> => invoke('ai:test-connection'),
  getWechatConfig: (): Promise<WechatConfigDto> => invoke('wechat:get-config'),
  saveWechatConfig: (input: unknown): Promise<WechatConfigDto> => invoke('wechat:save-config', input),
  testWechatConnection: (): Promise<WechatConnectionResult> => invoke('wechat:test-connection'),
  listWechatSessions: (): Promise<WechatSession[]> => invoke('wechat:list-sessions'),
  getWeFlowConfig: (): Promise<WeFlowConfigDto> => invoke('weflow:get-config'),
  saveWeFlowConfig: (input: unknown): Promise<WeFlowConfigDto> => invoke('weflow:save-config', input),
  testWeFlowConnection: (): Promise<WeFlowConnectionResult> => invoke('weflow:test-connection'),
  listWeFlowSessions: (): Promise<WechatSession[]> => invoke('weflow:list-sessions'),
  getOrderDashboard: (): Promise<{ candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }> => invoke('order:get-dashboard'),
  analyzeOrders: (range?: { beginTimestamp?: number; endTimestamp?: number }): Promise<{ candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }> => invoke('order:analyze', range),
  subscribeOrderAnalysisProgress: (listener: (dashboard: { candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dashboard: { candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }) => listener(dashboard);
    ipcRenderer.on('order:analysis-progress', handler);
    return () => ipcRenderer.off('order:analysis-progress', handler);
  },
  getOrderAnalysisDebug: (): Promise<{ startedAt: number; finishedAt: number | null; steps: Array<{ stage: string; message: string; details?: Record<string, unknown> }> } | null> => invoke('order:get-analysis-debug'),
  listOrderProjectFolders: (): Promise<Array<{ name: string; path: string }>> => invoke('order:list-project-folders'),
  confirmOrderCandidate: (id: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null; folderMode?: 'new' | 'existing' | 'none'; folderPath?: string | null }): Promise<OrderRecord> => invoke('order:confirm-candidate', id, input),
  ignoreOrderCandidate: (id: string): Promise<void> => invoke('order:ignore-candidate', id),
  deleteOrderCandidate: (id: string): Promise<void> => invoke('order:delete-candidate', id),
  deleteOrder: (id: string): Promise<void> => invoke('order:delete-order', id),
  addOrderTransaction: (id: string, input: { type: 'initial' | 'follow-up' | 'refund'; amount: number; occurredAt: number; note: string; evidenceMessageIds: string[] }): Promise<OrderRecord> => invoke('order:add-transaction', id, input),
  addOrderMaintenance: (id: string, input: { occurredAt: number; content: string; nextFollowUpAt: number | null }): Promise<OrderRecord> => invoke('order:add-maintenance', id, input),
  subscribeOrderChanges: (listener: () => void): (() => void) => {
    const handler = () => listener();
    ipcRenderer.on('order:changed', handler);
    return () => ipcRenderer.off('order:changed', handler);
  },
});
