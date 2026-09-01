import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readAiConfig } from '../ai/config-repository.js';
import type { AppDatabase } from '../database/connection.js';
import { canConnectWechat, readWechatConfig } from '../wechat/wechat-config.js';
import { wechatService } from '../wechat/wechat-service.js';
import { readWeFlowConfig } from '../weflow/weflow-config.js';
import { weFlowBridge } from '../weflow/weflow-bridge.js';
import { analyzeDeal } from './deal-analyzer.js';
import { formatFolderName, matchesRemarkPrefix, nextAvailableFolderName, renderFolderTemplate } from './order-utils.js';
import { scanProjectFolders } from './folder-scanner.js';
import { OrderRepository } from './order-repository.js';
import type { DealCandidate, MaintenanceRecord, OrderRecord, RevenueSummary, Transaction, WechatMessage } from './order-types.js';
import type { WechatSession } from '../wechat/wechat-types.js';

export interface DealDashboard {
  candidates: DealCandidate[];
  orders: OrderRecord[];
  summary: RevenueSummary;
}

export function shouldUseWeFlow(config: { enabled: boolean }, weflowConfig: { apiToken: string; sourcePath: string; executablePath: string }): boolean {
  return !config.enabled || Boolean(weflowConfig.apiToken || weflowConfig.sourcePath || weflowConfig.executablePath);
}

export class OrderService {
  private readonly repository: OrderRepository;
  constructor(private readonly database: AppDatabase, private readonly userDataPath: string) { this.repository = new OrderRepository(database); }

  async analyze(): Promise<DealDashboard> {
    const config = await readWechatConfig(this.userDataPath);
    const weflowConfig = await readWeFlowConfig(this.userDataPath);
    let sessions: WechatSession[];
    let readMessages: (session: WechatSession) => Promise<WechatMessage[]>;
    if (shouldUseWeFlow(config, weflowConfig)) {
      await weFlowBridge.ensureRunning(weflowConfig);
      sessions = await weFlowBridge.listSessions(weflowConfig);
      readMessages = (session) => weFlowBridge.listMessages(weflowConfig, session);
    } else {
      if (!canConnectWechat(config)) throw new Error('请先配置 WeFlow API Token，或配置旧版微信账号目录和解密 Key');
      const connection = await wechatService.connect(config);
      if (!connection.ok) throw new Error(connection.message);
      sessions = await wechatService.listSessions();
      readMessages = (session) => wechatService.listMessages(session);
    }
    const selected = new Set(config.selectedSessionIds);
    const targets = sessions.filter((session) => selected.has(session.id) || Boolean(session.remarkName && matchesRemarkPrefix(session.remarkName, config.remarkPrefixes)));
    const folders = await scanProjectFolders(config.projectsRoot).catch(() => []);
    const aiConfig = await readAiConfig(this.userDataPath);
    for (const session of targets) {
      const messages = await readMessages(session);
      const latest = messages.at(-1)?.sentAt ? new Date(messages.at(-1)!.sentAt) : new Date();
      const folder = folders.find((item) => item.name.includes(session.name)) || folders.find((item) => item.datePrefix === `${String(latest.getMonth() + 1).padStart(2, '0')}-${String(latest.getDate()).padStart(2, '0')}`) || null;
      const candidate = await analyzeDeal(messages, folder, aiConfig);
      if (candidate) this.repository.saveCandidate(candidate);
    }
    return this.dashboard();
  }

  dashboard(): DealDashboard {
    const candidates = this.repository.listCandidates();
    const orders = this.repository.listOrders();
    const transactions = orders.flatMap((order) => order.transactions.map((transaction) => ({ ...transaction, id: `${order.id}:${transaction.id}` })));
    const gross = transactions.filter((item) => item.type !== 'refund').reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const refunds = transactions.filter((item) => item.type === 'refund').reduce((sum, item) => sum + Math.abs(item.amount), 0);
    return { candidates, orders, summary: { gross, refunds, net: gross - refunds, orderCount: orders.length, pendingCandidateCount: candidates.length } };
  }

  async confirmCandidate(candidateId: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null }): Promise<OrderRecord> {
    const candidate = this.repository.listCandidates(200).find((item) => item.id === candidateId);
    if (!candidate) throw new Error('待确认线索不存在或已处理');
    const config = await readWechatConfig(this.userDataPath);
    const date = new Date(input.confirmedAt);
    const root = config.projectsRoot;
    const yearDir = join(root, String(date.getFullYear()));
    await mkdir(yearDir, { recursive: true });
    const baseName = renderFolderTemplate(config.folderTemplate || '{MM-DD}_{projectName}', date, input.projectName || candidate.projectName);
    const names = await readdir(yearDir, { withFileTypes: true }).then((items) => items.filter((item) => item.isDirectory()).map((item) => item.name)).catch(() => []);
    const folderName = nextAvailableFolderName(baseName || formatFolderName(date, input.projectName), names);
    const folderPath = join(yearDir, folderName);
    await mkdir(folderPath, { recursive: false });
    const order: OrderRecord = { id: randomUUID(), customerName: input.customerName.trim() || candidate.customerName, sessionId: candidate.sessionId,
      projectName: input.projectName.trim() || candidate.projectName, folderPath, confirmedAt: input.confirmedAt, transactions: [], maintenance: [], evidence: candidate.evidence };
    if (input.amount !== null && input.amount > 0) order.transactions.push({ id: randomUUID(), type: 'initial', amount: input.amount, occurredAt: input.confirmedAt, note: '首单', evidenceMessageIds: candidate.evidence.map((item) => item.id) });
    this.repository.confirmCandidate(candidateId, order);
    return order;
  }

  addTransaction(orderId: string, input: Omit<Transaction, 'id'>): OrderRecord { return this.repository.addTransaction(orderId, { ...input, id: randomUUID() }); }
  addMaintenance(orderId: string, input: Omit<MaintenanceRecord, 'id'>): OrderRecord { return this.repository.addMaintenance(orderId, { ...input, id: randomUUID() }); }
}
