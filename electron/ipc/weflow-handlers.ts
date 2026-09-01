import { ipcMain } from 'electron';
import { readWeFlowConfig, toWeFlowConfigDto, writeWeFlowConfig } from '../weflow/weflow-config.js';
import { weFlowBridge } from '../weflow/weflow-bridge.js';
import type { WeFlowConfig } from '../weflow/weflow-types.js';

export interface WeFlowIpcContext { getUserDataPath(): string; onConfigChanged?: () => void | Promise<void>; }

export function registerWeFlowIpcHandlers(context: WeFlowIpcContext): void {
  ipcMain.handle('weflow:get-config', async () => toWeFlowConfigDto(await readWeFlowConfig(context.getUserDataPath())));
  ipcMain.handle('weflow:save-config', async (_event, raw: unknown) => {
    const current = await readWeFlowConfig(context.getUserDataPath());
    const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const next: WeFlowConfig = {
      sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath.trim() : current.sourcePath,
      executablePath: typeof value.executablePath === 'string' ? value.executablePath.trim() : current.executablePath,
      baseUrl: typeof value.baseUrl === 'string' && value.baseUrl.trim() ? value.baseUrl.trim().replace(/\/+$/, '') : current.baseUrl,
      apiToken: typeof value.apiToken === 'string' && value.apiToken.trim() ? value.apiToken.trim() : current.apiToken,
      autoStart: value.autoStart === true,
    };
    await writeWeFlowConfig(context.getUserDataPath(), next);
    await context.onConfigChanged?.();
    return toWeFlowConfigDto(next);
  });
  ipcMain.handle('weflow:test-connection', async () => {
    const config = await readWeFlowConfig(context.getUserDataPath());
    try {
      await weFlowBridge.ensureRunning(config);
      const sessions = await weFlowBridge.listSessions(config);
      return { ok: true, message: 'WeFlow HTTP API 连接成功', sessionCount: sessions.length };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'WeFlow 连接失败' };
    }
  });
  ipcMain.handle('weflow:list-sessions', async () => {
    const config = await readWeFlowConfig(context.getUserDataPath());
    if (!config.apiToken) return [];
    return weFlowBridge.listSessions(config);
  });
}
