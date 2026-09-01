import { createHash } from 'node:crypto';
import type { StoredAiConfig } from '../ai/ai-types.js';
import type { DealCandidate, ProjectFolder, WechatMessage } from './order-types.js';

function candidateId(sessionId: string, messages: WechatMessage[]): string {
  return createHash('sha1').update(`${sessionId}:${messages.at(-1)?.id ?? Date.now()}`).digest('hex').slice(0, 20);
}

function heuristic(messages: WechatMessage[], folder: ProjectFolder | null): DealCandidate | null {
  const text = messages.map((item) => item.text).join('\n');
  if (!/(已付款|已转账|定金|成交|可以做|就这个|确定做|安排制作|下单)/i.test(text)) return null;
  const amountMatch = text.match(/(?:¥|￥|金额|报价|定金|转账)\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const customer = messages.find((item) => !item.isSelf)?.senderName || messages[0]?.sessionName || '未知客户';
  const projectName = folder?.name.replace(/^\d{2}[-_]\d{2}[-_]/, '') || '待确认项目';
  return { id: candidateId(messages[0]?.sessionId || 'unknown', messages), sessionId: messages[0]?.sessionId || '', sessionName: messages[0]?.sessionName || '',
    customerName: customer, projectName, confidence: 0.62, amount: amountMatch ? Number(amountMatch[1]) : null,
    dealTime: messages.at(-1)?.sentAt ?? null, evidence: messages.slice(-12), matchedFolder: folder, status: 'candidate' };
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
