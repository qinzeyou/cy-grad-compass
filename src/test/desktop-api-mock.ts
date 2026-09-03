// 中文注释：测试辅助：为 window.desktopApi 安装可断言的 mock。各测试文件按需
// 覆盖具体方法，未覆盖的方法返回安全默认值，避免组件挂载时因 API 缺失报错。
import { vi } from 'vitest';
import type { DevelopmentSessionDetail } from '../features/project-development/project-development-types';
import type { Project, ProjectStatistics } from '../features/project-statistics/project-statistics-types';
import type { Template } from '../features/project-management/project-management-types';
import type { AiConfigDto, AiConnectionResult, AiSaveConfigInput } from '../features/settings/settings-types';
import type { WechatConfigDto, WechatConnectionResult, WechatSession } from '../features/settings/wechat-types';
import type { WeFlowConfigDto, WeFlowConnectionResult } from '../../electron/weflow/weflow-types';
import type { OrderDashboard } from '../features/order-analysis/order-types';

function makeProject(): Project {
  return {
    id: 'p1',
    name: '示例项目',
    path: 'C:/demo',
    status: 'in-progress',
    templateId: 't1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeStatistics(): ProjectStatistics {
  return { total: 0, inProgress: 0, completed: 0, archived: 0, recentProjects: [] };
}

function makeTemplate(): Template {
  return { id: 't1', name: '默认模板', storedPath: 'C:/templates/t1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
}

function makeSessionDetail(): DevelopmentSessionDetail {
  return {
    id: 's1',
    projectId: 'p1',
    projectName: '示例项目',
    title: '初始会话',
    codexThreadId: null,
    phase: 'discussion',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [],
  };
}

export function installDesktopApiMock(overrides: Partial<Window['desktopApi']> = {}): Window['desktopApi'] {
  const api: Window['desktopApi'] = {
    getAppVersion: vi.fn(async () => '0.1.0'),
    openPath: vi.fn(async () => ''),
    minimizeWindow: vi.fn(async () => undefined),
    toggleMaximizeWindow: vi.fn(async () => false),
    closeWindow: vi.fn(async () => undefined),
    isMaximized: vi.fn(async () => false),
    selectDirectory: vi.fn(async () => null),
    selectFile: vi.fn(async () => null),
    getProjectStatistics: vi.fn(async () => makeStatistics()),
    listProjects: vi.fn(async () => []),
    updateProject: vi.fn(async () => ({ project: makeProject(), statistics: makeStatistics() })),
    updateProjectStatus: vi.fn(async () => ({ project: makeProject(), statistics: makeStatistics() })),
    createProject: vi.fn(async () => makeProject()),
    openProjectPath: vi.fn(async () => undefined),
    getTemplate: vi.fn(async () => makeTemplate()),
    importTemplate: vi.fn(async () => null),
    replaceTemplate: vi.fn(async () => null),
    listDevelopmentSessions: vi.fn(async () => []),
    getDevelopmentSession: vi.fn(async () => makeSessionDetail()),
    createDevelopmentSession: vi.fn(async () => makeSessionDetail()),
    sendDevelopmentMessage: vi.fn(async () => undefined),
    startDevelopment: vi.fn(async () => undefined),
    continueDevelopment: vi.fn(async () => undefined),
    pauseDevelopment: vi.fn(async () => undefined),
    stopDevelopment: vi.fn(async () => undefined),
    deleteDevelopmentSession: vi.fn(async () => undefined),
    listSkills: vi.fn(async () => []),
    listSkillFeatures: vi.fn(async () => []),
    getSkill: vi.fn(async () => ({ id: 'skill-1', name: '示例技能', description: '', source: 'imported' as const, createdAt: '', updatedAt: '', instructions: '' })),
    getSkillFeature: vi.fn(async () => ({ id: 'skill-1:main', skillId: 'skill-1', name: '示例功能', description: '', skillName: '示例技能', source: 'imported' as const, updatedAt: '', instructions: '' })),
    importSkill: vi.fn(async () => ({ id: 'skill-1', name: '示例技能', description: '', source: 'imported' as const, createdAt: '', updatedAt: '' })),
    extractSkill: vi.fn(async () => ({ id: 'skill-1', name: '示例技能', description: '', source: 'extracted' as const, createdAt: '', updatedAt: '' })),
    deleteSkill: vi.fn(async () => undefined),
    deleteSkillFeature: vi.fn(async () => undefined),
    subscribeDevelopmentEvents: vi.fn(() => () => undefined),
    getAiConfig: vi.fn(async (): Promise<AiConfigDto> => ({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiBaseUrl: 'https://api.deepseek.com',
      hasApiKey: false,
    })),
    saveAiConfig: vi.fn(async (_input: AiSaveConfigInput): Promise<AiConfigDto> => ({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiBaseUrl: 'https://api.deepseek.com',
      hasApiKey: true,
    })),
    testAiConnection: vi.fn(async (): Promise<AiConnectionResult> => ({ ok: true, provider: 'deepseek', model: 'deepseek-chat', elapsedMs: 120 })),
    getWechatConfig: vi.fn(async (): Promise<WechatConfigDto> => ({ accountDir: '', hasDecryptKey: false, enabled: false, remarkPrefixes: ['鱼', '书'], selectedSessionIds: [], projectsRoot: 'E:\\副业\\开发', folderTemplate: '{MM-DD}_{projectName}' })),
    saveWechatConfig: vi.fn(async (): Promise<WechatConfigDto> => ({ accountDir: '', hasDecryptKey: true, enabled: false, remarkPrefixes: ['鱼', '书'], selectedSessionIds: [], projectsRoot: 'E:\\副业\\开发', folderTemplate: '{MM-DD}_{projectName}' })),
    testWechatConnection: vi.fn(async (): Promise<WechatConnectionResult> => ({ ok: false, message: '未配置' })),
    listWechatSessions: vi.fn(async (): Promise<WechatSession[]> => []),
    getWeFlowConfig: vi.fn(async (): Promise<WeFlowConfigDto> => ({ sourcePath: '', executablePath: '', baseUrl: 'http://127.0.0.1:5031', autoStart: false, hasApiToken: false })),
    saveWeFlowConfig: vi.fn(async (): Promise<WeFlowConfigDto> => ({ sourcePath: '', executablePath: '', baseUrl: 'http://127.0.0.1:5031', autoStart: false, hasApiToken: true })),
    testWeFlowConnection: vi.fn(async (): Promise<WeFlowConnectionResult> => ({ ok: false, message: '未配置 WeFlow API Token' })),
    listWeFlowSessions: vi.fn(async (): Promise<WechatSession[]> => []),
    getOrderDashboard: vi.fn(async (): Promise<OrderDashboard> => ({ candidates: [], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 } })),
    analyzeOrders: vi.fn(async (): Promise<OrderDashboard> => ({ candidates: [], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 } })),
    subscribeOrderAnalysisProgress: vi.fn(() => () => undefined),
    getOrderAnalysisDebug: vi.fn(async () => null),
    listOrderProjectFolders: vi.fn(async () => []),
    confirmOrderCandidate: vi.fn(),
    ignoreOrderCandidate: vi.fn(async () => undefined),
    deleteOrderCandidate: vi.fn(async () => undefined),
    deleteOrder: vi.fn(async () => undefined),
    addOrderTransaction: vi.fn(),
    addOrderMaintenance: vi.fn(),
    subscribeOrderChanges: vi.fn(() => () => undefined),
    ...overrides,
  };
  window.desktopApi = api;
  return api;
}
