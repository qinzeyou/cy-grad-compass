import type { WebContents } from 'electron';
import { ipcMain } from 'electron';
import type { DevelopmentEvent, DevelopmentEventEnvelope } from './development-types.js';
import type { DevelopmentService } from './development-service.js';

export interface DevelopmentIpcRegistrar {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`缺少${label}`);
  return value.trim();
}

// 中文注释：将主进程事件投递给当前窗口，渲染进程只接收稳定 envelope，不接触内部对象。
export function sendDevelopmentEvent(webContents: WebContents | null, sessionId: string, event: DevelopmentEvent): void {
  if (webContents !== null && !webContents.isDestroyed()) {
    webContents.send('development:event', { sessionId, event } satisfies DevelopmentEventEnvelope);
  }
}

export function registerDevelopmentIpcHandlers(
  service: DevelopmentService,
  registrar: DevelopmentIpcRegistrar = ipcMain,
): void {
  registrar.handle('development:list-sessions', () => service.listSessions());
  registrar.handle('development:get-session', (_event, id) => service.getSession(text(id, '开发会话编号')));
  registrar.handle('development:create-session', (_event, projectId) => service.createSession(text(projectId, '项目编号')));
  registrar.handle('development:send-message', (_event, id, message, mode, skillId) => service.sendMessage(text(id, '开发会话编号'), text(message, '消息'), mode === 'development' || mode === 'feature-extraction' ? mode : 'discussion', typeof skillId === 'string' ? skillId : undefined));
  registrar.handle('development:start', (_event, id, skillId) => service.startDevelopment(text(id, '开发会话编号'), typeof skillId === 'string' ? skillId : undefined));
  registrar.handle('development:continue', (_event, id) => service.continueDevelopment(text(id, '开发会话编号')));
  registrar.handle('development:pause', (_event, id) => service.pause(text(id, '开发会话编号')));
  registrar.handle('development:stop', (_event, id) => service.stop(text(id, '开发会话编号')));
  registrar.handle('development:delete-session', (_event, id) => service.deleteSession(text(id, '开发会话编号')));
  registrar.handle('development:delete-workspace', (_event, projectId) => service.deleteWorkspace(text(projectId, '项目编号')));
}
