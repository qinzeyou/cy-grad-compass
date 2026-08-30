import type { DevelopmentEvent } from './development-types.js';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

// 中文注释：Codex 协议可能新增事件，未知事件必须转日志而不是中断当前开发会话。
export function parseCodexJsonLine(line: string): DevelopmentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed) as unknown; } catch { return { type: 'log', text: line }; }
  const event = record(parsed);
  if (event === null || typeof event.type !== 'string') return { type: 'log', text: line };
  if (event.type === 'thread.started' && typeof event.thread_id === 'string') return { type: 'thread-started', threadId: event.thread_id };
  if (event.type === 'turn.started') return { type: 'turn-started' };
  if (event.type === 'turn.completed') return { type: 'turn-completed' };
  if (event.type === 'turn.failed' || event.type === 'error') {
    const error = record(event.error);
    return { type: 'run-error', message: string(error?.message, string(event.message, 'Codex 执行失败')) };
  }
  const item = record(event.item);
  if (item === null) return { type: 'log', text: line };
  if (event.type === 'item.completed' && item.type === 'agent_message' && typeof item.text === 'string') return { type: 'assistant-message', text: item.text };
  if (event.type === 'item.started' && item.type === 'command_execution') return { type: 'command-started', id: string(item.id, 'command'), command: string(item.command) };
  if (event.type === 'item.completed' && item.type === 'command_execution') return { type: 'command-completed', id: string(item.id, 'command'), command: string(item.command), output: string(item.aggregated_output).slice(-4000), exitCode: typeof item.exit_code === 'number' ? item.exit_code : null };
  if (event.type === 'item.completed' && item.type === 'file_change' && Array.isArray(item.changes)) {
    return { type: 'file-change', paths: item.changes.flatMap((change) => { const value = record(change); return value && typeof value.path === 'string' ? [value.path] : []; }) };
  }
  return { type: 'log', text: line };
}
