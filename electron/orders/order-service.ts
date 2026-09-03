import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readAiConfig } from '../ai/config-repository.js';
import type { AppDatabase } from '../database/connection.js';
import { canConnectWechat, readWechatConfig } from '../wechat/wechat-config.js';
import { wechatService } from '../wechat/wechat-service.js';
import { analyzeDealsDetailed, dedupeCandidates, dedupeCandidatesWithIds, isUsableCandidate } from './deal-analyzer.js';
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

export interface AnalysisDebugStep { stage: string; message: string; details?: Record<string, unknown>; }
export interface AnalysisDebug { startedAt: number; finishedAt: number | null; steps: AnalysisDebugStep[]; }
export interface AnalysisRange { beginTimestamp?: number; endTimestamp?: number; }
export interface ConfirmCandidateInput { projectName: string; customerName: string; confirmedAt: number; amount: number | null; folderMode?: 'new' | 'existing' | 'none'; folderPath?: string | null; }

export function createAnalysisDebug(startedAt = Date.now()): AnalysisDebug { return { startedAt, finishedAt: null, steps: [] }; }
export function recordAnalysisStep(debug: AnalysisDebug, stage: string, message: string, details?: Record<string, unknown>): void {
  debug.steps.push({ stage, message, ...(details ? { details } : {}) });
}

function latestOrderTime(order: OrderRecord): number {
  return Math.max(order.confirmedAt, ...order.transactions.map((item) => item.occurredAt));
}

function mergeOrdersByCustomer(orders: OrderRecord[]): { orders: OrderRecord[]; duplicateIds: string[] } {
  const merged: OrderRecord[] = [];
  const duplicateIds: string[] = [];
  for (const order of orders.sort((left, right) => latestOrderTime(right) - latestOrderTime(left))) {
    const existing = merged.find((item) => item.sessionId === order.sessionId);
    if (!existing) { merged.push(order); continue; }
    duplicateIds.push(order.id);
    existing.customerName = order.customerName || existing.customerName;
    existing.nickname = order.nickname || existing.nickname;
    existing.remarkName = order.remarkName || existing.remarkName;
    existing.avatarUrl = order.avatarUrl || existing.avatarUrl;
    existing.projectName = order.projectName || existing.projectName;
    existing.folderPath = existing.folderPath || order.folderPath;
    existing.confirmedAt = Math.max(existing.confirmedAt, order.confirmedAt);
    for (const transaction of order.transactions) {
      const duplicate = existing.transactions.some((item) => item.id === transaction.id
        || (item.type === transaction.type && item.amount === transaction.amount && item.occurredAt === transaction.occurredAt
          && item.evidenceMessageIds.some((id) => transaction.evidenceMessageIds.includes(id))));
      if (!duplicate) existing.transactions.push(transaction);
    }
    existing.transactions.sort((left, right) => left.occurredAt - right.occurredAt);
    existing.maintenance = [...existing.maintenance, ...order.maintenance].sort((left, right) => left.occurredAt - right.occurredAt);
    existing.evidence = [...new Map([...existing.evidence, ...order.evidence].map((item) => [item.id, item])).values()].sort((left, right) => left.sentAt - right.sentAt);
  }
  return { orders: merged, duplicateIds };
}

export function shouldUseWeFlow(_config: { enabled: boolean }, _weflowConfig: { apiToken: string; sourcePath: string; executablePath: string }): boolean {
  return false;
}

export class OrderService {
  private readonly repository: OrderRepository;
  private latestAnalysisDebug: AnalysisDebug | null = null;
  constructor(private readonly database: AppDatabase, private readonly userDataPath: string) { this.repository = new OrderRepository(database); }

  async analyze(range: AnalysisRange = {}, onProgress?: (dashboard: DealDashboard) => void): Promise<DealDashboard> {
    const debug = createAnalysisDebug();
    this.latestAnalysisDebug = debug;
    try {
    const config = await readWechatConfig(this.userDataPath);
    recordAnalysisStep(debug, 'config', '已读取微信配置', { accountDir: config.accountDir, hasDecryptKey: Boolean(config.decryptKey), enabled: config.enabled, remarkPrefixes: config.remarkPrefixes, selectedSessionCount: config.selectedSessionIds.length, projectsRoot: config.projectsRoot });
    if (!canConnectWechat(config)) { recordAnalysisStep(debug, 'config', '微信配置不完整'); throw new Error('请先配置微信账号目录和解密 Key'); }
    const connection = await wechatService.connect(config);
    recordAnalysisStep(debug, 'connect', connection.ok ? '微信数据库连接成功' : '微信数据库连接失败', { sessionCount: connection.sessionCount ?? 0, message: connection.message });
    if (!connection.ok) { throw new Error(connection.message); }
    const sessions = await wechatService.listSessions();
    recordAnalysisStep(debug, 'sessions', `读取到 ${sessions.length} 个会话`, { sessionCount: sessions.length, sample: sessions.slice(0, 20).map((item) => ({ id: item.id, name: item.name, remarkName: item.remarkName, type: item.type })) });
    const readMessages = (session: WechatSession) => wechatService.listMessages(session, range);
    const selected = new Set(config.selectedSessionIds);
    const targets = sessions.filter((session) => selected.has(session.id) || Boolean(session.remarkName && matchesRemarkPrefix(session.remarkName, config.remarkPrefixes)));
    recordAnalysisStep(debug, 'filter', `匹配到 ${targets.length} 个目标会话`, { selectedMatches: targets.filter((item) => selected.has(item.id)).length, remarkMatches: targets.filter((item) => !selected.has(item.id)).length, targets: targets.map((item) => ({ id: item.id, name: item.name, remarkName: item.remarkName, type: item.type })) });
    await wechatService.enrichAvatars(targets);
    const folders = await scanProjectFolders(config.projectsRoot).catch(() => []);
    recordAnalysisStep(debug, 'folders', `扫描到 ${folders.length} 个项目文件夹`, { projectsRoot: config.projectsRoot });
    const aiConfig = await readAiConfig(this.userDataPath);
    recordAnalysisStep(debug, 'ai', aiConfig.apiKey.trim() ? '使用 DeepSeek 分析' : '未配置 AI，使用本地规则分析', { model: aiConfig.model, hasApiKey: Boolean(aiConfig.apiKey.trim()) });
    for (const session of targets) {
      let messages: WechatMessage[];
      try {
        messages = await readMessages(session);
      } catch (error) {
        recordAnalysisStep(debug, 'messages', `${session.name} 读取消息失败，已跳过`, { sessionId: session.id, error: error instanceof Error ? error.message : String(error) });
        onProgress?.(this.dashboard());
        continue;
      }
      recordAnalysisStep(debug, 'messages', `${session.name} 读取到 ${messages.length} 条文本消息`, { sessionId: session.id, messageCount: messages.length, lastMessageAt: messages.at(-1)?.sentAt ?? null });
      const ignoredAt = this.repository.findLatestIgnoredAt(session.id);
      if (ignoredAt) messages = messages.filter((message) => message.sentAt > ignoredAt);
      if (messages.length === 0) { recordAnalysisStep(debug, 'decision', `${session.name} 跳过：没有可分析的文本消息`, { sessionId: session.id }); onProgress?.(this.dashboard()); continue; }
      const analysis = await analyzeDealsDetailed(messages, folders, aiConfig);
      for (const candidate of analysis.candidates) {
        if (!isUsableCandidate(candidate)) {
          recordAnalysisStep(debug, 'decision', `${session.name} 跳过无效成交记录`, { sessionId: session.id, candidateId: candidate.id, reason: '缺少会话、客户或聊天证据' });
          continue;
        }
        const matchedFolder = candidate.matchedFolder || folders.find((item) => item.name.includes(candidate.projectName)) || null;
        const nextCandidate = { ...candidate, matchedFolder, userId: session.id, nickname: session.nickname || session.name, remarkName: session.remarkName, avatarUrl: session.avatarUrl };
        const duplicates = this.repository.listCandidates(200).filter((item) => dedupeCandidates([item, nextCandidate]).length === 1);
        for (const duplicate of duplicates.slice(1)) this.repository.deleteCandidate(duplicate.id);
        this.repository.saveCandidate({ ...nextCandidate, id: duplicates[0]?.id || nextCandidate.id });
      }
      recordAnalysisStep(debug, 'decision', `${session.name} 识别到 ${analysis.candidates.length} 条成交记录`, { sessionId: session.id, candidateCount: analysis.candidates.length, candidates: analysis.candidates.map((candidate) => ({ amount: candidate.amount, confidence: candidate.confidence, dealTime: candidate.dealTime, projectName: candidate.projectName })), ai: analysis.diagnostics });
      onProgress?.(this.dashboard());
    }
    const dashboard = this.dashboard();
    recordAnalysisStep(debug, 'summary', `分析完成：发现 ${dashboard.candidates.length} 条待确认线索，已确认订单 ${dashboard.orders.length} 笔`, { candidateCount: dashboard.candidates.length, orderCount: dashboard.orders.length });
    return dashboard;
    } finally {
      debug.finishedAt ??= Date.now();
    }
  }

  getAnalysisDebug(): AnalysisDebug | null { return this.latestAnalysisDebug; }

  deleteCandidate(candidateId: string): void {
    if (!this.repository.deleteCandidate(candidateId)) throw new Error('待确认线索不存在或已处理');
  }

  ignoreCandidate(candidateId: string): void {
    const candidate = this.repository.listCandidates(200).find((item) => item.id === candidateId);
    if (!candidate) throw new Error('待确认线索不存在或已处理');
    const ignoredAt = Math.max(candidate.dealTime || 0, ...candidate.evidence.map((message) => message.sentAt), Date.now());
    if (!this.repository.ignoreCandidate(candidateId, ignoredAt)) throw new Error('待确认线索不存在或已处理');
  }

  async listProjectFolders(): Promise<Array<{ name: string; path: string }>> {
    const config = await readWechatConfig(this.userDataPath);
    return (await scanProjectFolders(config.projectsRoot).catch(() => [])).map(({ name, path }) => ({ name, path }));
  }

  deleteOrder(orderId: string): void {
    if (!this.repository.deleteOrder(orderId)) throw new Error('订单不存在或已删除');
  }

  dashboard(): DealDashboard {
    const storedCandidates = this.repository.listCandidates(1000);
    const invalidIds = storedCandidates.filter((candidate) => !isUsableCandidate(candidate)).map((candidate) => candidate.id);
    for (const id of invalidIds) this.repository.deleteCandidate(id);
    const deduped = dedupeCandidatesWithIds(storedCandidates.filter(isUsableCandidate));
    for (const id of deduped.duplicateIds) this.repository.deleteCandidate(id);
    const candidates = deduped.candidates.sort((left, right) => (right.dealTime ?? -Infinity) - (left.dealTime ?? -Infinity));
    const orderMerge = mergeOrdersByCustomer(this.repository.listOrders());
    for (const id of orderMerge.duplicateIds) this.repository.deleteOrder(id);
    for (const order of orderMerge.orders) this.repository.updateOrder(order);
    const orders = orderMerge.orders;
    const transactions = orders.flatMap((order) => order.transactions.map((transaction) => ({ ...transaction, id: `${order.id}:${transaction.id}` })));
    const gross = transactions.filter((item) => item.type !== 'refund').reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    const refunds = transactions.filter((item) => item.type === 'refund').reduce((sum, item) => sum + Math.abs(item.amount), 0);
    return { candidates, orders, summary: { gross, refunds, net: gross - refunds, orderCount: orders.length, pendingCandidateCount: candidates.length } };
  }

  async confirmCandidate(candidateId: string, input: ConfirmCandidateInput): Promise<OrderRecord> {
    const candidate = this.repository.listCandidates(200).find((item) => item.id === candidateId);
    if (!candidate) throw new Error('待确认线索不存在或已处理');
    const config = await readWechatConfig(this.userDataPath);
    let folderPath: string | null = null;
    if (input.folderMode === 'existing') {
      const folders = await scanProjectFolders(config.projectsRoot).catch(() => []);
      folderPath = folders.some((folder) => folder.path === input.folderPath) ? input.folderPath || null : null;
      if (!folderPath) throw new Error('请选择有效的已有项目文件夹');
    } else if (input.folderMode !== 'none' && !this.repository.listOrders().some((item) => item.sessionId === candidate.sessionId)) {
      const date = new Date(input.confirmedAt);
      const yearDir = join(config.projectsRoot, String(date.getFullYear()));
      await mkdir(yearDir, { recursive: true });
      const baseName = renderFolderTemplate(config.folderTemplate || '{MM-DD}_{projectName}', date, input.projectName || candidate.projectName);
      const names = await readdir(yearDir, { withFileTypes: true }).then((items) => items.filter((item) => item.isDirectory()).map((item) => item.name)).catch(() => []);
      folderPath = join(yearDir, nextAvailableFolderName(baseName || formatFolderName(date, input.projectName), names));
      await mkdir(folderPath, { recursive: false });
    }
    const order: OrderRecord = { id: randomUUID(), customerName: input.customerName.trim() || candidate.remarkName || candidate.nickname || candidate.customerName, nickname: candidate.nickname, remarkName: candidate.remarkName, avatarUrl: candidate.avatarUrl, sessionId: candidate.sessionId,
      projectName: input.projectName.trim() || candidate.projectName, folderPath, confirmedAt: input.confirmedAt, transactions: [], maintenance: [], evidence: candidate.evidence };
    if (input.amount !== null && input.amount > 0) order.transactions.push({ id: randomUUID(), type: 'initial', amount: input.amount, occurredAt: input.confirmedAt, note: '首单', evidenceMessageIds: candidate.evidence.map((item) => item.id) });
    return this.repository.confirmCandidate(candidateId, order);
  }

  addTransaction(orderId: string, input: Omit<Transaction, 'id'>): OrderRecord { return this.repository.addTransaction(orderId, { ...input, id: randomUUID() }); }
  addMaintenance(orderId: string, input: Omit<MaintenanceRecord, 'id'>): OrderRecord { return this.repository.addMaintenance(orderId, { ...input, id: randomUUID() }); }
}
