import type { DevelopmentEventEnvelope, DevelopmentSession, DevelopmentSessionDetail, SkillFeature, SkillFeatureDetail, SkillSummary } from './project-development-types';

// 中文注释：渲染进程只通过这一层访问 preload，避免页面组件依赖 Electron API 细节。
export const listSessions = (): Promise<DevelopmentSession[]> => window.desktopApi.listDevelopmentSessions();
export const getSession = (id: string): Promise<DevelopmentSessionDetail> => window.desktopApi.getDevelopmentSession(id);
export const createSession = (projectId: string): Promise<DevelopmentSessionDetail> => window.desktopApi.createDevelopmentSession(projectId);
export const sendMessage = (id: string, text: string, mode: 'discussion' | 'development', skillId?: string): Promise<void> => window.desktopApi.sendDevelopmentMessage(id, text, mode, skillId);
export const startDevelopment = (id: string, skillId?: string): Promise<void> => window.desktopApi.startDevelopment(id, skillId);
export const continueDevelopment = (id: string): Promise<void> => window.desktopApi.continueDevelopment(id);
export const pauseDevelopment = (id: string): Promise<void> => window.desktopApi.pauseDevelopment(id);
export const stopDevelopment = (id: string): Promise<void> => window.desktopApi.stopDevelopment(id);
export const deleteSession = (id: string): Promise<void> => window.desktopApi.deleteDevelopmentSession(id);
export const subscribeDevelopmentEvents = (listener: (event: DevelopmentEventEnvelope) => void): (() => void) => window.desktopApi.subscribeDevelopmentEvents(listener);
export const listSkills = (): Promise<SkillSummary[]> => window.desktopApi.listSkills();
export const getSkill = (id: string) => window.desktopApi.getSkill(id);
export const listSkillFeatures = (): Promise<SkillFeature[]> => window.desktopApi.listSkillFeatures();
export const getSkillFeature = (id: string): Promise<SkillFeatureDetail> => window.desktopApi.getSkillFeature(id);
export const importSkill = (path: string): Promise<SkillSummary> => window.desktopApi.importSkill(path);
export const extractSkill = (input: { name: string; description?: string; instructions: string }): Promise<SkillSummary> => window.desktopApi.extractSkill(input);
export const deleteSkill = (id: string): Promise<void> => window.desktopApi.deleteSkill(id);
export const deleteSkillFeature = (id: string): Promise<void> => window.desktopApi.deleteSkillFeature(id);
