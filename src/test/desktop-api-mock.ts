// 中文注释：测试辅助：为 window.desktopApi 安装可断言的 mock。各测试文件按需
// 覆盖具体方法，未覆盖的方法返回安全默认值，避免组件挂载时因 API 缺失报错。
import { vi } from 'vitest';
import type { DevelopmentSessionDetail } from '../features/project-development/project-development-types';
import type { Project, ProjectStatistics } from '../features/project-statistics/project-statistics-types';
import type { Template } from '../features/project-management/project-management-types';
import type { AiConfigDto, AiConnectionResult, AiSaveConfigInput } from '../features/settings/settings-types';

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
    stopDevelopment: vi.fn(async () => undefined),
    deleteDevelopmentSession: vi.fn(async () => undefined),
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
    ...overrides,
  };
  window.desktopApi = api;
  return api;
}
