import { join } from 'node:path';
import { app } from 'electron';
import { wcdbService } from './services/wcdbService.js';
import type { WechatMessage } from '../orders/order-types.js';
import type { WechatConfig, WechatConnectionResult, WechatSession } from './wechat-types.js';

function resourcesPath(): string {
  return process.env.VITE_DEV_SERVER_URL ? join(process.cwd(), 'resources') : process.resourcesPath;
}

function mapSession(raw: any): WechatSession {
  const id = String(raw.username ?? raw.id ?? raw.sessionId ?? '');
  const type = String(raw.type ?? '').toLowerCase();
  return { id, name: String(raw.displayName ?? raw.name ?? id), type: type.includes('group') || id.endsWith('@chatroom') ? 'group' : 'private', remarkName: raw.remarkName ?? raw.remark };
}

function mapMessage(raw: any, session: WechatSession): WechatMessage {
  return { id: String(raw.serverId ?? raw.localId ?? `${session.id}:${raw.createTime}`), sessionId: session.id, sessionName: session.name,
    senderName: String(raw.accountName ?? raw.senderName ?? raw.senderUsername ?? session.name), senderId: raw.senderUsername,
    isSelf: Number(raw.isSend ?? 0) === 1, text: String(raw.parsedContent ?? raw.content ?? raw.rawContent ?? '').trim(), sentAt: Number(raw.createTime ?? 0) * 1000 };
}

export class WechatService {
  private config: WechatConfig | null = null;
  private listener: (() => void) | null = null;

  setConfig(config: WechatConfig): void { this.config = config; }

  async connect(config: WechatConfig): Promise<WechatConnectionResult> {
    this.config = config;
    if (!config.accountDir || !config.decryptKey) return { ok: false, message: '请先配置微信账号目录和解密 Key' };
    wcdbService.setPaths(resourcesPath(), app.getPath('userData'));
    const ok = await wcdbService.open(config.accountDir, config.decryptKey);
    if (!ok) return { ok: false, message: (await wcdbService.getLastInitError()) || '微信数据库打开失败' };
    const result = await wcdbService.getSessions();
    return result.success ? { ok: true, message: '微信数据库连接成功', sessionCount: result.sessions?.length ?? 0 } : { ok: false, message: result.error || '读取微信会话失败' };
  }

  async listSessions(): Promise<WechatSession[]> {
    const result = await wcdbService.getSessions();
    if (!result.success) throw new Error(result.error || '读取微信会话失败');
    return (result.sessions || []).map(mapSession).filter((item) => item.id);
  }

  async listMessages(session: WechatSession, limit = 300): Promise<WechatMessage[]> {
    const result = await wcdbService.getMessages(session.id, limit, 0);
    if (!result.success) throw new Error(result.error || '读取微信消息失败');
    return (result.messages || []).map((item) => mapMessage(item, session)).filter((item) => item.text);
  }

  startMonitor(onChange: () => void): void {
    this.listener = onChange;
    wcdbService.setMonitor(() => this.listener?.());
  }

  isReady(): boolean { return wcdbService.isReady(); }

  async stop(): Promise<void> {
    this.listener = null;
    await wcdbService.shutdown();
  }
}

export const wechatService = new WechatService();
