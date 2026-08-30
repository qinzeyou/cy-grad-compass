import { useEffect, useState, type ReactElement } from 'react';
import type { DevelopmentRunView } from './project-development-types';

type Props = { run: DevelopmentRunView; onStop: () => void };
const LABELS = { idle: '等待开始', running: '运行中', completed: '已完成', error: '执行失败', stopped: '已停止' } as const;
function elapsed(startedAt: number | null): string { if (startedAt === null) return '00:00'; const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }

// 中文注释：右栏只呈现真实 Codex 事件，不根据消息内容推测进度或 Agent 状态。
export function DevelopmentRunPanel({ run, onStop }: Props): ReactElement {
  const [clock, setClock] = useState(0);
  useEffect(() => { if (run.status !== 'running') return undefined; const timer = window.setInterval(() => setClock((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [run.status]);
  void clock;
  return <aside className="development-run"><header className="run-head"><div><span className="eyebrow">CODEX RUNTIME</span><h2>AI 运行情况</h2></div><span className={`run-indicator ${run.status}`} /></header><div className="run-summary"><div className={`run-state ${run.status}`}><span>{LABELS[run.status]}</span><strong>{elapsed(run.startedAt)}</strong></div><p>{run.currentAction}</p><div className="run-counters"><span><strong>{run.commandCount}</strong> 命令</span><span><strong>{run.changedPaths.length}</strong> 文件变更</span></div></div><div className="run-agent"><span className="agent-avatar">CX</span><div><strong>主 Agent</strong><small>Codex CLI · 工作区权限</small></div><span className={`agent-badge ${run.status}`}>{LABELS[run.status]}</span></div><div className="run-log-head"><span>运行日志</span><small>{run.logs.length.toString().padStart(2, '0')} EVENTS</small></div><ol className="run-log">{run.logs.map((log) => <li key={log.id}><span className="log-dot" /><span><strong>{log.label}</strong>{log.detail && <small>{log.detail}</small>}</span></li>)}</ol>{run.status === 'running' && <button className="stop-button" type="button" onClick={onStop}>■ 停止运行</button>}<div className="simulation-note">讨论阶段只读；开发阶段仅允许写入项目目录。</div></aside>;
}
