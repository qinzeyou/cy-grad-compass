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
import type {
  AiConfigDto,
  AiConnectionResult,
  AiSaveConfigInput,
} from './features/settings/settings-types';
import type { DealCandidate, OrderRecord, RevenueSummary } from './features/order-analysis/order-types';
import type { WechatConfigDto, WechatConnectionResult, WechatSession } from './features/settings/wechat-types';
import type { WeFlowConfigDto, WeFlowConnectionResult } from '../electron/weflow/weflow-types';

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
      selectFile: () => Promise<string | null>;
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
      continueDevelopment: (sessionId: string) => Promise<void>;
      pauseDevelopment: (sessionId: string) => Promise<void>;
      stopDevelopment: (sessionId: string) => Promise<void>;
      deleteDevelopmentSession: (sessionId: string) => Promise<void>;
      subscribeDevelopmentEvents: (listener: (envelope: DevelopmentEventEnvelope) => void) => () => void;
      getAiConfig: () => Promise<AiConfigDto>;
      saveAiConfig: (input: AiSaveConfigInput) => Promise<AiConfigDto>;
      testAiConnection: () => Promise<AiConnectionResult>;
      getWechatConfig: () => Promise<WechatConfigDto>;
      saveWechatConfig: (input: unknown) => Promise<WechatConfigDto>;
      testWechatConnection: () => Promise<WechatConnectionResult>;
      listWechatSessions: () => Promise<WechatSession[]>;
      getWeFlowConfig: () => Promise<WeFlowConfigDto>;
      saveWeFlowConfig: (input: unknown) => Promise<WeFlowConfigDto>;
      testWeFlowConnection: () => Promise<WeFlowConnectionResult>;
      listWeFlowSessions: () => Promise<WechatSession[]>;
      getOrderDashboard: () => Promise<{ candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }>;
      analyzeOrders: (range?: { beginTimestamp?: number; endTimestamp?: number }) => Promise<{ candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }>;
      subscribeOrderAnalysisProgress: (listener: (dashboard: { candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary }) => void) => () => void;
      getOrderAnalysisDebug?: () => Promise<{ startedAt: number; finishedAt: number | null; steps: Array<{ stage: string; message: string; details?: Record<string, unknown> }> } | null>;
      listOrderProjectFolders: () => Promise<Array<{ name: string; path: string }>>;
      confirmOrderCandidate: (id: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null; folderMode?: 'new' | 'existing' | 'none'; folderPath?: string | null }) => Promise<OrderRecord>;
      ignoreOrderCandidate: (id: string) => Promise<void>;
      deleteOrderCandidate: (id: string) => Promise<void>;
      deleteOrder: (id: string) => Promise<void>;
      addOrderTransaction: (id: string, input: { type: 'initial' | 'follow-up' | 'refund'; amount: number; occurredAt: number; note: string; evidenceMessageIds: string[] }) => Promise<OrderRecord>;
      addOrderMaintenance: (id: string, input: { occurredAt: number; content: string; nextFollowUpAt: number | null }) => Promise<OrderRecord>;
      subscribeOrderChanges: (listener: () => void) => () => void;
    };
  }
}

export {};
