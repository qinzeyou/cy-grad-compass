import { useEffect, useState, type ReactElement } from 'react';
import { Button, Divider, Tag, Typography } from 'antd';
import { StopOutlined } from '@ant-design/icons';
import type { DevelopmentRunView } from './project-development-types';

type Props = { run: DevelopmentRunView; onStop: () => void };
const LABELS = { idle: '等待开始', running: '运行中', completed: '已完成', error: '执行失败', stopped: '已停止' } as const;
const elapsed = (startedAt: number | null) => startedAt === null ? '00:00' : `${String(Math.floor((Date.now() - startedAt) / 60000)).padStart(2, '0')}:${String(Math.floor((Date.now() - startedAt) / 1000) % 60).padStart(2, '0')}`;

// 中文注释：右栏只呈现事件与模拟运行状态，不推测 AI 行为。
export function DevelopmentRunPanel({ run, onStop }: Props): ReactElement {
  const [clock, setClock] = useState(0); useEffect(() => { if (run.status !== 'running') return undefined; const timer = window.setInterval(() => setClock((value) => value + 1), 1000); return () => window.clearInterval(timer); }, [run.status]); void clock;
  return <aside className="development-run"><header className="run-head"><div><Typography.Text className="eyebrow">CODEX RUNTIME</Typography.Text><Typography.Title level={4}>AI 运行情况</Typography.Title></div><Tag color={run.status === 'running' ? 'gold' : run.status === 'error' ? 'red' : 'blue'}>{LABELS[run.status]}</Tag></header><div className="run-summary"><div className="run-state"><Typography.Text>{LABELS[run.status]}</Typography.Text><Typography.Title level={3}>{elapsed(run.startedAt)}</Typography.Title></div><Typography.Text type="secondary">{run.currentAction}</Typography.Text><div className="run-counters"><span><strong>{run.commandCount}</strong> 命令</span><span><strong>{run.changedPaths.length}</strong> 文件变更</span></div></div><Divider /><div className="run-log-head"><span>运行日志</span><small>{run.logs.length.toString().padStart(2, '0')} EVENTS</small></div><ol className="run-log">{run.logs.map((log) => <li key={log.id}><span className="log-dot" /><span><strong>{log.label}</strong>{log.detail && <small>{log.detail}</small>}</span></li>)}</ol>{run.status === 'running' && <Button danger icon={<StopOutlined />} onClick={onStop}>停止运行</Button>}<Typography.Text type="secondary" className="simulation-note">讨论阶段只读；开发阶段仅允许写入项目目录。</Typography.Text></aside>;
}
