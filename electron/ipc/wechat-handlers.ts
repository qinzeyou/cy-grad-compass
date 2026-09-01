import { ipcMain } from 'electron';
import { readWechatConfig, toWechatConfigDto, writeWechatConfig } from '../wechat/wechat-config.js';
import { wechatService } from '../wechat/wechat-service.js';
import type { WechatConfig } from '../wechat/wechat-types.js';

export interface WechatIpcContext { getUserDataPath(): string; onConfigChanged?: () => void | Promise<void>; }
export function registerWechatIpcHandlers(context: WechatIpcContext): void {
  ipcMain.handle('wechat:get-config', async () => toWechatConfigDto(await readWechatConfig(context.getUserDataPath())));
  ipcMain.handle('wechat:save-config', async (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('微信配置不能为空');
    const current = await readWechatConfig(context.getUserDataPath());
    const value = raw as Record<string, unknown>;
    const next: WechatConfig = {
      ...current,
      accountDir: typeof value.accountDir === 'string' ? value.accountDir.trim() : current.accountDir,
      decryptKey: typeof value.decryptKey === 'string' && value.decryptKey.trim() ? value.decryptKey.trim() : current.decryptKey,
      enabled: value.enabled === true,
      remarkPrefixes: Array.isArray(value.remarkPrefixes) ? value.remarkPrefixes.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : current.remarkPrefixes,
      selectedSessionIds: Array.isArray(value.selectedSessionIds) ? value.selectedSessionIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : current.selectedSessionIds,
      projectsRoot: typeof value.projectsRoot === 'string' && value.projectsRoot.trim() ? value.projectsRoot.trim() : current.projectsRoot,
      folderTemplate: typeof value.folderTemplate === 'string' && value.folderTemplate.trim() ? value.folderTemplate.trim() : current.folderTemplate,
    };
    await writeWechatConfig(context.getUserDataPath(), next);
    await context.onConfigChanged?.();
    return toWechatConfigDto(next);
  });
  ipcMain.handle('wechat:test-connection', async () => wechatService.connect(await readWechatConfig(context.getUserDataPath())));
  ipcMain.handle('wechat:list-sessions', async () => wechatService.listSessions());
}
