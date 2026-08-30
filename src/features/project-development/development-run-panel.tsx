import type { ReactElement } from 'react';
import type { DevelopmentRun } from './project-development-types';

type Props = { run: DevelopmentRun; onStop: () => void };
const STATUS_LABELS = { idle: '等待开始', queued: '排队中', running: '运行中', completed: '已完成', stopped: '已停止' } as const;

// 中文注释：右栏是模拟运行的只读投影，后续接入真实 Agent 时替换数据来源即可。
export function DevelopmentRunPanel({ run, onStop }: Props): ReactElement {
  const active = run.status === 'queued' || run.status === 'running';
  return <aside className="development-run"><header className="run-head"><div><span className="eyebrow">RUNTIME MONITOR</span><h2>AI 运行情况</h2></div><span className={`run-indicator ${run.status}`} /> </header><div className="run-summary"><div className={`run-state ${run.status}`}><span>{STATUS_LABELS[run.status]}</span><strong>{run.progress}%</strong></div><div className="progress-track"><div className="progress-value" style={{ width: `${run.progress}%` }} /></div><p>{run.currentAction}</p></div><div className="run-agent"><span className="agent-avatar">AI</span><div><strong>主 Agent</strong><small>模拟执行器</small></div><span className={`agent-badge ${run.status}`}>{STATUS_LABELS[run.status]}</span></div><div className="run-log-head"><span>运行日志</span><small>{run.logs.length.toString().padStart(2, '0')} EVENTS</small></div><ol className="run-log">{run.logs.map((log, index) => <li key={`${log}-${index}`}><span className="log-dot" /><span>{log}</span></li>)}</ol>{active && <button className="stop-button" type="button" onClick={onStop}>■ 停止运行</button>}<div className="simulation-note">当前为模拟状态，AI 不会读取或修改项目目录。</div></aside>;
}
