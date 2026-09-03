import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { app } from 'electron';
import { wcdbService } from './services/wcdbService.js';
import type { WechatMessage } from '../orders/order-types.js';
import type { WechatConfig, WechatConnectionResult, WechatSession } from './wechat-types.js';

type WcdbClient = Pick<typeof wcdbService, 'setPaths' | 'initialize' | 'open' | 'getLastInitError' | 'getSessions' | 'getContactsCompact' | 'getAvatarUrls' | 'getMessages' | 'openMessageCursor' | 'fetchMessageBatch' | 'closeMessageCursor' | 'setMonitor' | 'isReady' | 'shutdown'>;
type ElectronApp = Pick<typeof app, 'getAppPath' | 'getPath'>;

function resourcesPath(electronApp: ElectronApp): string {
  const packagedRoot = process.resourcesPath || electronApp.getAppPath();
  const candidate = process.env.VITE_DEV_SERVER_URL
    ? join(electronApp.getAppPath(), 'resources')
    : join(packagedRoot, 'resources');
  return existsSync(candidate) ? candidate : join(process.cwd(), 'resources');
}

function mapSession(raw: any): WechatSession {
  const id = String(raw.username ?? raw.id ?? raw.sessionId ?? '');
  const type = String(raw.type ?? '').toLowerCase();
  return { id, name: String(raw.displayName ?? raw.name ?? id), type: type.includes('group') || id.endsWith('@chatroom') ? 'group' : 'private', remarkName: raw.remarkName ?? raw.remark };
}

function mapMessage(raw: any, session: WechatSession): WechatMessage {
  const value = (keys: string[]): unknown => keys.map((key) => raw[key]).find((item) => item !== null && item !== undefined && String(item).trim() !== '');
  const createTime = Number(value(['createTime', 'create_time', 'timestamp', 'sortTimestamp']) ?? 0);
  const senderId = value(['senderUsername', 'sender_username', 'realSenderId', 'real_sender_id']);
  return { id: String(value(['serverId', 'server_id', 'svrid', 'localId', 'local_id']) ?? `${session.id}:${createTime}`), sessionId: session.id, sessionName: session.name,
    senderName: String(value(['accountName', 'account_name', 'senderName', 'sender_name', 'senderUsername', 'sender_username']) ?? session.name), senderId: senderId === undefined ? undefined : String(senderId),
    isSelf: Number(value(['isSend', 'is_send']) ?? 0) === 1, text: String(value(['parsedContent', 'parsed_content', 'content', 'messageContent', 'message_content', 'message_content_text', 'str_content', 'msg_content', 'rawContent', 'raw_content']) ?? '').trim(), sentAt: createTime * 1000 };
}

export class WechatService {
  private config: WechatConfig | null = null;
  private listener: (() => void) | null = null;
  private connected = false;

  constructor(private readonly wcdb = wcdbService, private readonly electronApp: ElectronApp = app) {}

  setConfig(config: WechatConfig): void { this.config = config; }

  async prepare(): Promise<boolean> {
    this.wcdb.setPaths(resourcesPath(this.electronApp), this.electronApp.getPath('userData'));
    return this.wcdb.initialize();
  }

  async connect(config: WechatConfig): Promise<WechatConnectionResult> {
    this.config = config;
    if (!config.accountDir || !config.decryptKey) return { ok: false, message: '请先配置微信账号目录和解密 Key' };
    if (!await this.prepare()) return { ok: false, message: (await this.wcdb.getLastInitError()) || '微信数据库初始化失败' };
    const ok = await this.wcdb.open(config.accountDir, config.decryptKey);
    if (!ok) return { ok: false, message: (await this.wcdb.getLastInitError()) || '微信数据库打开失败' };
    const result = await this.wcdb.getSessions();
    this.connected = result.success;
    return result.success ? { ok: true, message: '微信数据库连接成功', sessionCount: result.sessions?.length ?? 0 } : { ok: false, message: result.error || '读取微信会话失败' };
  }

  async listSessions(): Promise<WechatSession[]> {
    const result = await this.wcdb.getSessions();
    if (!result.success) throw new Error(result.error || '读取微信会话失败');
    const sessions = (result.sessions || []).map(mapSession).filter((item) => item.id);
    if (sessions.length === 0) return sessions;
    const contacts = await this.wcdb.getContactsCompact(sessions.map((item) => item.id)).catch(() => ({ success: false as const, contacts: [] }));
    const contactMap = new Map((contacts.contacts || []).map((item: any) => [String(item.username || ''), item]));
    return sessions.map((session) => {
      const contact = contactMap.get(session.id);
      if (!contact) return session;
      return { ...session, name: String(contact.remark || contact.nick_name || contact.nickName || session.name), nickname: String(contact.nick_name || contact.nickName || session.name), remarkName: contact.remark || contact.remarkName || session.remarkName };
    });
  }

  async enrichAvatars(sessions: WechatSession[]): Promise<void> {
    const result = await this.wcdb.getAvatarUrls(sessions.map((item) => item.id)).catch(() => ({ success: false as const, map: {} }));
    if (!result.success || !result.map) return;
    for (const session of sessions) session.avatarUrl = result.map[session.id];
  }

  async listMessages(session: WechatSession, range: { beginTimestamp?: number; endTimestamp?: number } = {}): Promise<WechatMessage[]> {
    const beginMs = range.beginTimestamp && range.beginTimestamp < 1e12 ? range.beginTimestamp * 1000 : range.beginTimestamp || 0;
    const endMs = range.endTimestamp && range.endTimestamp < 1e12 ? range.endTimestamp * 1000 : range.endTimestamp || 0;
    const rows: any[] = [];
    const begin = beginMs ? Math.floor(beginMs / 1000) : 0;
    const end = endMs ? Math.floor(endMs / 1000) : 0;
    const cursorResult = await this.wcdb.openMessageCursor(session.id, 1000, true, begin, end);
    if (cursorResult.success && cursorResult.cursor) {
      try {
        for (;;) {
          const batch = await this.wcdb.fetchMessageBatch(cursorResult.cursor);
          if (!batch.success) throw new Error(batch.error || '获取微信消息失败');
          rows.push(...(batch.rows || []));
          if (!batch.hasMore) break;
        }
      } finally {
        await this.wcdb.closeMessageCursor(cursorResult.cursor);
      }
    } else {
      // 兼容旧版数据服务：游标接口不可用时回退到分页接口。
      for (let offset = 0; ; offset += 1000) {
        const result = await this.wcdb.getMessages(session.id, 1000, offset);
        if (!result.success) {
          if (/(-3|消息数据库未找到|no message db)/i.test(`${cursorResult.error || ''} ${result.error || ''}`)) return [];
          throw new Error(cursorResult.error || result.error || '读取微信消息失败');
        }
        rows.push(...(result.messages || []));
        if ((result.messages || []).length < 1000) break;
      }
    }
    return rows.map((item) => mapMessage(item, session)).filter((item) => item.text && (!beginMs || item.sentAt >= beginMs) && (!endMs || item.sentAt <= endMs)).sort((a, b) => a.sentAt - b.sentAt);
  }

  startMonitor(onChange: () => void): void {
    this.listener = onChange;
    this.wcdb.setMonitor(() => this.listener?.());
  }

  isReady(): boolean { return this.wcdb.isReady(); }
  isConnected(): boolean { return this.connected; }

  async stop(): Promise<void> {
    this.listener = null;
    this.connected = false;
    await this.wcdb.shutdown();
  }
}

export const wechatService = new WechatService();
