import { spawn as nodeSpawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { WechatMessage } from '../orders/order-types.js';
import type { WechatSession } from '../wechat/wechat-types.js';
import type { WeFlowBridgeDeps, WeFlowConfig } from './weflow-types.js';

const defaultDeps: WeFlowBridgeDeps = {
  fetch: (input, init) => fetch(input, init),
  spawn: (target) => {
    const isSource = existsSync(target) && statSync(target).isDirectory();
    const child = isSource
      ? process.platform === 'win32'
        ? nodeSpawn('cmd.exe', ['/d', '/s', '/c', 'if not exist node_modules npm install && npm run dev'], { cwd: target, detached: true, stdio: 'ignore', windowsHide: true })
        : nodeSpawn('sh', ['-lc', 'if [ ! -d node_modules ]; then npm install; fi; npm run dev'], { cwd: target, detached: true, stdio: 'ignore' })
      : nodeSpawn(target, [], { detached: true, stdio: 'ignore', windowsHide: true });
    return { unref: () => child.unref() };
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class WeFlowBridge {
  private startedProcess = false;
  constructor(private readonly deps: WeFlowBridgeDeps = defaultDeps) {}

  async health(config: WeFlowConfig): Promise<boolean> {
    try { const response = await this.deps.fetch(`${config.baseUrl}/api/v1/health`, { headers: this.headers(config) }); return response.ok; } catch { return false; }
  }

  async ensureRunning(config: WeFlowConfig): Promise<void> {
    await this.prepareSourceApi(config);
    if (await this.health(config)) return;
    const target = config.sourcePath || config.executablePath;
    if (!config.autoStart || !target) throw new Error('WeFlow 未运行，请先启动 WeFlow 或配置源码目录');
    this.deps.spawn(target).unref(); this.startedProcess = true;
    for (let attempt = 0; attempt < 120; attempt += 1) { await this.deps.wait(500); if (await this.health(config)) return; }
    throw new Error('WeFlow 启动后未能连接本地 HTTP API，请确认已开启 API 服务');
  }

  async listSessions(config: WeFlowConfig): Promise<WechatSession[]> {
    await this.ensureRunning(config);
    const [sessionPayload, contactPayload] = await Promise.all([this.request(config, '/api/v1/sessions?format=chatlab&limit=10000'), this.request(config, '/api/v1/contacts?limit=10000')]);
    const contacts = new Map<string, any>((Array.isArray(contactPayload.contacts) ? contactPayload.contacts : []).map((item: any) => [String(item.username ?? item.id ?? ''), item]));
    return (Array.isArray(sessionPayload.sessions) ? sessionPayload.sessions : []).map((item: any) => { const id = String(item.id ?? item.username ?? ''); const contact = contacts.get(id); return { id, name: String(item.name ?? item.displayName ?? contact?.displayName ?? id), type: item.type === 'group' || id.endsWith('@chatroom') ? 'group' : 'private', remarkName: contact?.remark }; }).filter((item: WechatSession) => item.id);
  }

  async listMessages(config: WeFlowConfig, session: WechatSession, limit = 300): Promise<WechatMessage[]> {
    await this.ensureRunning(config);
    const payload = await this.request(config, `/api/v1/sessions/${encodeURIComponent(session.id)}/messages?limit=${limit}`);
    return (Array.isArray(payload.messages) ? payload.messages : []).map((item: any) => {
      const timestamp = Number(item.timestamp ?? item.createTime ?? 0);
      return {
        id: String(item.platformMessageId ?? item.serverId ?? item.localId ?? `${session.id}:${timestamp}`),
        sessionId: session.id,
        sessionName: session.name,
        senderName: String(item.accountName ?? item.senderDisplayName ?? item.senderName ?? item.senderUsername ?? item.sender ?? session.name),
        senderId: item.senderUsername ?? item.sender,
        isSelf: Number(item.isSend ?? 0) === 1,
        text: String(item.content ?? item.parsedContent ?? item.rawContent ?? '').trim(),
        sentAt: timestamp < 1e12 ? timestamp * 1000 : timestamp,
      };
    }).filter((item: WechatMessage) => item.text).sort((a: WechatMessage, b: WechatMessage) => a.sentAt - b.sentAt);
  }

  wasStartedByBridge(): boolean { return this.startedProcess; }
  private headers(config: WeFlowConfig): HeadersInit { return config.apiToken ? { Authorization: `Bearer ${config.apiToken}` } : {}; }
  private async prepareSourceApi(config: WeFlowConfig): Promise<void> {
    if (!config.sourcePath || process.platform !== 'win32' || !process.env.APPDATA) return;
    const candidates = [join(process.env.APPDATA, 'WeFlow', 'WeFlow-config.json'), join(process.env.APPDATA, 'weflow', 'WeFlow-config.json')];
    const path = candidates.find((item) => existsSync(item));
    if (!path) return;
    try {
      const raw = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
      const configuredToken = typeof raw.httpApiToken === 'string' ? raw.httpApiToken.trim() : '';
      const token = config.apiToken.trim() || configuredToken || randomBytes(24).toString('hex');
      const port = (() => { try { return Number(new URL(config.baseUrl).port) || 5031; } catch { return 5031; } })();
      const changed = raw.httpApiEnabled !== true || raw.httpApiPort !== port || raw.httpApiToken !== token;
      if (changed) await writeFile(path, JSON.stringify({ ...raw, httpApiEnabled: true, httpApiPort: port, httpApiToken: token }, null, 2), 'utf8');
      config.apiToken = token;
    } catch {
      // 配置文件不可写时保留原配置，后续健康检查会返回明确错误。
    }
  }
  private async request(config: WeFlowConfig, path: string): Promise<any> { const response = await this.deps.fetch(`${config.baseUrl}${path}`, { headers: this.headers(config) }); if (!response.ok) throw new Error(`WeFlow API 请求失败（HTTP ${response.status}）`); const payload = await response.json(); if (payload?.success === false) throw new Error(payload.error || 'WeFlow API 返回失败'); return payload; }
}

export const weFlowBridge = new WeFlowBridge();
