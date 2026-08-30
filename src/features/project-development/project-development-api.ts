import type { DevelopmentEventEnvelope, DevelopmentSession, DevelopmentSessionDetail } from './project-development-types';

// 中文注释：渲染进程只通过这一层访问 preload，避免页面组件依赖 Electron API 细节。
export const listSessions = (): Promise<DevelopmentSession[]> => window.desktopApi.listDevelopmentSessions();
export const getSession = (id: string): Promise<DevelopmentSessionDetail> => window.desktopApi.getDevelopmentSession(id);
export const createSession = (projectId: string): Promise<DevelopmentSessionDetail> => window.desktopApi.createDevelopmentSession(projectId);
export const sendMessage = (id: string, text: string): Promise<void> => window.desktopApi.sendDevelopmentMessage(id, text);
export const startDevelopment = (id: string): Promise<void> => window.desktopApi.startDevelopment(id);
export const stopDevelopment = (id: string): Promise<void> => window.desktopApi.stopDevelopment(id);
export const subscribeDevelopmentEvents = (listener: (event: DevelopmentEventEnvelope) => void): (() => void) => window.desktopApi.subscribeDevelopmentEvents(listener);
