import { createHash } from 'node:crypto';
import type { StoredAiConfig } from '../ai/ai-types.js';
import type { DealCandidate, ProjectFolder, WechatMessage } from './order-types.js';

export interface DealAnalysisDiagnostics {
  mode: 'deepseek' | 'heuristic' | 'heuristic-fallback';
  batchCount: number;
  aiDealCount: number;
  fallbackReason?: string;
}

export interface DealAnalysisResult {
  candidates: DealCandidate[];
  diagnostics: DealAnalysisDiagnostics;
}

export function isUsableCandidate(candidate: DealCandidate): boolean {
  return Boolean(candidate.sessionId && candidate.evidence.length > 0 && candidate.customerName.trim() && candidate.customerName !== '未知客户');
}

function candidateId(sessionId: string, messages: WechatMessage[]): string {
  return createHash('sha1').update(`${sessionId}:${messages.at(-1)?.id ?? Date.now()}`).digest('hex').slice(0, 20);
}

function hasSharedEvidence(left: DealCandidate, right: DealCandidate): boolean {
  const ids = new Set(left.evidence.map((item) => item.id));
  return right.evidence.some((item) => ids.has(item.id));
}

function isSameDeal(left: DealCandidate, right: DealCandidate): boolean {
  if (left.sessionId !== right.sessionId) return false;
  if (!hasSharedEvidence(left, right)) return false;
  const sameTransaction = left.amount != null && right.amount != null && left.amount === right.amount
    && left.dealTime != null && right.dealTime != null && Math.abs(left.dealTime - right.dealTime) <= 10 * 60 * 1000;
  if (left.projectName !== right.projectName && !sameTransaction) return false;
  if (left.amount != null && right.amount != null && left.amount !== right.amount) return false;
  if (left.dealTime == null || right.dealTime == null) return true;
  return Math.abs(left.dealTime - right.dealTime) <= 24 * 60 * 60 * 1000;
}

export function dedupeCandidatesWithIds(candidates: DealCandidate[]): { candidates: DealCandidate[]; duplicateIds: string[] } {
  const result: DealCandidate[] = [];
  const duplicateIds: string[] = [];
  for (const candidate of candidates) {
    const existing = result.find((item) => isSameDeal(item, candidate));
    if (!existing) { result.push(candidate); continue; }
    duplicateIds.push(candidate.id);
    existing.amount = candidate.amount ?? existing.amount;
    if (candidate.projectName.length > existing.projectName.length) existing.projectName = candidate.projectName;
    existing.dealTime = Math.max(existing.dealTime ?? 0, candidate.dealTime ?? 0) || null;
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
    existing.evidence = [...new Map([...existing.evidence, ...candidate.evidence].map((item) => [item.id, item])).values()].sort((a, b) => a.sentAt - b.sentAt);
  }
  return { candidates: result, duplicateIds };
}

export function dedupeCandidates(candidates: DealCandidate[]): DealCandidate[] {
  return dedupeCandidatesWithIds(candidates).candidates;
}

function heuristic(messages: WechatMessage[], folder: ProjectFolder | null): DealCandidate | null {
  const text = messages.map((item) => item.text).join('\n');
  if (!/(已付款|已支付|已转账|已打款|已收款|收到了|到账|定金|首款|尾款|成交|可以做|就这个|确定做|安排制作|下单|开工|开始做)/i.test(text)) return null;
  const amountMatch = text.match(/(?:¥|￥|金额|报价|定金|首款|尾款|转账|打款|支付|收款|一共|总共)\s*[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i)
    || text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:元|块|块钱)/i);
  const customer = messages.find((item) => !item.isSelf)?.senderName || messages[0]?.sessionName || '未知客户';
  const projectName = folder?.name.replace(/^\d{2}[-_]\d{2}[-_]/, '') || '待确认项目';
  return { id: candidateId(messages[0]?.sessionId || 'unknown', messages), sessionId: messages[0]?.sessionId || '', sessionName: messages[0]?.sessionName || '',
    customerName: customer, projectName, confidence: 0.62, amount: amountMatch ? Number(amountMatch[1]) : null,
    dealTime: messages.at(-1)?.sentAt ?? null, evidence: messages.slice(-12), matchedFolder: folder, status: 'candidate' };
}

function heuristicMany(messages: WechatMessage[], folders: ProjectFolder[]): DealCandidate[] {
  const result: DealCandidate[] = [];
  const dealPattern = /(已付款|已支付|已转账|已打款|已收款|收到了|到账|定金|首款|尾款|成交|可以做|就这个|确定做|安排制作|下单|开工|开始做)/i;
  for (let index = 0; index < messages.length; index += 1) {
    if (!dealPattern.test(messages[index].text)) continue;
    const current = messages[index];
    const date = new Date(current.sentAt);
    const datePrefix = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const folder = folders.find((item) => item.year === date.getFullYear() && item.datePrefix === datePrefix)
      || folders.find((item) => item.name.toLowerCase().includes(current.text.toLowerCase().slice(0, 12)))
      || null;
    const context = messages.slice(Math.max(0, index - 4), Math.min(messages.length, index + 5));
    const candidate = heuristic(context, folder);
    if (!candidate) continue;
    const amountMatch = current.text.match(/(?:¥|￥|金额|报价|定金|首款|尾款|转账|打款|支付|收款|一共|总共)\s*[:：]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i)
      || current.text.match(/([0-9]+(?:\.[0-9]{1,2})?)\s*(?:元|块|块钱)/i);
    if (amountMatch) candidate.amount = Number(amountMatch[1]);
    candidate.id = candidateId(current.sessionId, [current]);
    candidate.dealTime = current.sentAt;
    candidate.evidence = context;
    result.push(candidate);
  }
  return dedupeCandidates(result).filter(isUsableCandidate);
}

function parseAiJson(raw: string): { deals?: Array<{ projectName?: string; amount?: number | null; confidence?: number; dealTime?: number | null; messageIds?: string[] }> } {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(normalized) as { deals?: Array<{ projectName?: string; amount?: number | null; confidence?: number; dealTime?: number | null; messageIds?: string[] }> };
}

export async function analyzeDealsDetailed(messages: WechatMessage[], folders: ProjectFolder[] = [], config: StoredAiConfig | null): Promise<DealAnalysisResult> {
  if (messages.length === 0) return { candidates: [], diagnostics: { mode: 'heuristic', batchCount: 0, aiDealCount: 0 } };
  if (!config?.apiKey.trim()) return { candidates: heuristicMany(messages, folders), diagnostics: { mode: 'heuristic', batchCount: 0, aiDealCount: 0 } };
  const chunkSize = 160;
  const overlap = 20;
  const batches: WechatMessage[][] = [];
  for (let start = 0; start < messages.length; start += chunkSize - overlap) batches.push(messages.slice(start, start + chunkSize));
  const results: DealCandidate[] = [];
  try {
    for (const batch of batches) {
      const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, stream: false, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: '你是成单识别助手。请从聊天记录中识别所有已经明确成交的订单，而不是仅仅有报价、咨询、意向或待确认线索。以下任一情况可判定成交：客户明确同意做并下单，客户或我方明确确认已付款/已收款/已到账/已转账/已打款，或明确安排开工且上下文显示订单已确认。只有“报价、考虑一下、发方案、问价格、未付款定金”不能判定成交。输出严格 JSON：{deals:[{projectName:string,amount:number|null,confidence:number,dealTime:number|null,messageIds:string[]}]};每笔成交必须引用支持判断的消息 id；未成交输出空数组。不要编造聊天记录中不存在的成交。' },
        { role: 'user', content: JSON.stringify(batch.map((item) => ({ id: item.id, sender: item.senderName, self: item.isSelf, text: item.text, sentAt: item.sentAt }))) },
      ] }) });
      if (!response.ok) return { candidates: heuristicMany(messages, folders), diagnostics: { mode: 'heuristic-fallback', batchCount: batches.length, aiDealCount: results.length, fallbackReason: `DeepSeek HTTP ${response.status}` } };
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const raw = payload.choices?.[0]?.message?.content || '';
      if (!raw) return { candidates: heuristicMany(messages, folders), diagnostics: { mode: 'heuristic-fallback', batchCount: batches.length, aiDealCount: results.length, fallbackReason: 'DeepSeek 返回空内容' } };
      const parsed = parseAiJson(raw);
      if (!Array.isArray(parsed.deals)) return { candidates: heuristicMany(messages, folders), diagnostics: { mode: 'heuristic-fallback', batchCount: batches.length, aiDealCount: results.length, fallbackReason: 'DeepSeek 返回格式不含 deals 数组' } };
      results.push(...parsed.deals.map((deal, index) => {
        const evidence = messages.filter((item) => deal.messageIds?.includes(item.id));
        const source = evidence.length ? evidence : batch.slice(Math.max(0, index - 2), index + 3);
        return { id: candidateId(messages[0].sessionId, evidence.length ? evidence : [batch[index] || batch[0]]), sessionId: messages[0].sessionId, sessionName: messages[0].sessionName,
          customerName: source.find((item) => !item.isSelf)?.senderName || messages[0].sessionName || '未知客户', projectName: deal.projectName?.trim() || '待确认项目', amount: typeof deal.amount === 'number' ? deal.amount : null,
          confidence: Math.max(0, Math.min(1, Number(deal.confidence) || 0.5)), dealTime: deal.dealTime ?? source.at(-1)?.sentAt ?? null, evidence: source, matchedFolder: null, status: 'candidate' as const };
      }));
    }
    return { candidates: dedupeCandidates(results).filter(isUsableCandidate), diagnostics: { mode: 'deepseek', batchCount: batches.length, aiDealCount: results.length } };
  } catch (error) {
    return { candidates: heuristicMany(messages, folders), diagnostics: { mode: 'heuristic-fallback', batchCount: batches.length, aiDealCount: results.length, fallbackReason: error instanceof Error ? error.message : 'DeepSeek 分析异常' } };
  }
}

export async function analyzeDeals(messages: WechatMessage[], folders: ProjectFolder[] = [], config: StoredAiConfig | null): Promise<DealCandidate[]> {
  return (await analyzeDealsDetailed(messages, folders, config)).candidates;
}

export async function analyzeDeal(messages: WechatMessage[], folder: ProjectFolder | null, config: StoredAiConfig | null): Promise<DealCandidate | null> {
  if (!config?.apiKey.trim()) return heuristic(messages, folder);
  const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, '')}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, stream: false, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: '你是成单识别助手。只根据聊天记录判断是否已明确成交。必须输出 JSON：isDeal(boolean), projectName(string), amount(number|null), confidence(number 0-1), dealTime(number|null)。未明确成交时 isDeal=false。' },
      { role: 'user', content: JSON.stringify(messages.map((item) => ({ sender: item.senderName, self: item.isSelf, text: item.text, sentAt: item.sentAt }))) },
    ] }) });
  if (!response.ok) return heuristic(messages, folder);
  try {
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) return heuristic(messages, folder);
    const value = JSON.parse(raw) as { isDeal?: boolean; projectName?: string; amount?: number | null; confidence?: number; dealTime?: number | null };
    if (value.isDeal !== true) return null;
    return { id: candidateId(messages[0]?.sessionId || 'unknown', messages), sessionId: messages[0]?.sessionId || '', sessionName: messages[0]?.sessionName || '',
      customerName: messages.find((item) => !item.isSelf)?.senderName || messages[0]?.sessionName || '未知客户', projectName: value.projectName?.trim() || folder?.name || '待确认项目',
      amount: typeof value.amount === 'number' ? value.amount : null, confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0.5)), dealTime: value.dealTime ?? messages.at(-1)?.sentAt ?? null,
      evidence: messages.slice(-12), matchedFolder: folder, status: 'candidate' };
  } catch {
    return heuristic(messages, folder);
  }
}
