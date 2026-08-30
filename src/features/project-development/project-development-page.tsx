import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { fetchProjectList } from '../project-statistics/project-statistics-api';
import type { Project } from '../project-statistics/project-statistics-types';
import { DevelopmentChatPanel } from './development-chat-panel';
import { DevelopmentRunPanel } from './development-run-panel';
import { DevelopmentSessionList } from './development-session-list';
import { createSession, getSession, listSessions, sendMessage, startDevelopment, stopDevelopment, subscribeDevelopmentEvents } from './project-development-api';
import type { DevelopmentEvent, DevelopmentEventEnvelope, DevelopmentRunView, DevelopmentSession, DevelopmentSessionDetail } from './project-development-types';
import './project-development.css';

const EMPTY_RUN: DevelopmentRunView = { status: 'idle', startedAt: null, commandCount: 0, changedPaths: [], currentAction: '等待 AI 任务', logs: [] };
const eventLog = (event: DevelopmentEvent): { label: string; detail?: string } => {
  if (event.type === 'command-started') return { label: '开始执行命令', detail: event.command };
  if (event.type === 'command-completed') return { label: event.exitCode === 0 ? '命令执行完成' : '命令执行失败', detail: event.command };
  if (event.type === 'file-change') return { label: '文件发生变更', detail: event.paths.join('、') || '未提供路径' };
  if (event.type === 'assistant-message') return { label: '收到 AI 回复' };
  if (event.type === 'run-error') return { label: '执行错误', detail: event.message };
  if (event.type === 'turn-started') return { label: 'AI 开始处理' };
  if (event.type === 'turn-completed') return { label: '本次任务完成' };
  if (event.type === 'process-exited') return { label: event.stopped ? '进程已停止' : '进程已退出' };
  if (event.type === 'thread-started') return { label: '已建立 Codex 会话' };
  return { label: event.text };
};

function asError(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason); }

// 中文注释：页面容器负责把持久化会话和实时事件合并成三个面板所需的读模型。
export function ProjectDevelopmentPage(): ReactElement {
  const [sessions, setSessions] = useState<DevelopmentSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSession, setActiveSession] = useState<DevelopmentSessionDetail | null>(null);
  const [runBySession, setRunBySession] = useState<Record<string, DevelopmentRunView>>({});
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const activeRun = activeSession ? (runBySession[activeSession.id] ?? EMPTY_RUN) : EMPTY_RUN;

  useEffect(() => {
    void Promise.all([listSessions(), fetchProjectList({ status: 'all' })]).then(async ([items, allProjects]) => {
      setSessions(items); setProjects(allProjects); if (items[0]) setActiveSession(await getSession(items[0].id));
    }).catch((reason: unknown) => setError(asError(reason)));
  }, []);

  useEffect(() => subscribeDevelopmentEvents((envelope: DevelopmentEventEnvelope) => {
    setRunBySession((current) => {
      const previous = current[envelope.sessionId] ?? EMPTY_RUN;
      const event = envelope.event;
      const next: DevelopmentRunView = { ...previous, logs: [...previous.logs, { id: `${Date.now()}-${previous.logs.length}`, ...eventLog(event) }].slice(-100) };
      if (event.type === 'turn-started') { next.status = 'running'; next.startedAt = previous.startedAt ?? Date.now(); next.currentAction = 'AI 正在处理需求'; }
      if (event.type === 'thread-started') next.currentAction = 'Codex 会话已建立';
      if (event.type === 'command-started') { next.status = 'running'; next.commandCount += 1; next.currentAction = event.command; }
      if (event.type === 'file-change') next.changedPaths = [...new Set([...next.changedPaths, ...event.paths])];
      if (event.type === 'assistant-message') next.currentAction = '正在整理 AI 回复';
      if (event.type === 'run-error') { next.status = 'error'; next.currentAction = event.message; }
      if (event.type === 'turn-completed') { next.status = 'completed'; next.currentAction = '本次任务完成'; }
      if (event.type === 'process-exited' && event.stopped) { next.status = 'stopped'; next.currentAction = '用户已停止任务'; }
      if (event.type === 'process-exited' && !event.stopped && next.status === 'running') { next.status = 'completed'; next.currentAction = '进程已退出'; }
      return { ...current, [envelope.sessionId]: next };
    });
    if (activeSession?.id === envelope.sessionId && ['assistant-message', 'process-exited', 'thread-started'].includes(envelope.event.type)) void getSession(envelope.sessionId).then(setActiveSession).catch(() => undefined);
  }), [activeSession?.id]);

  const selectSession = (id: string) => { setError(''); void getSession(id).then(setActiveSession).catch((reason: unknown) => setError(asError(reason))); };
  const handleCreate = (projectId: string) => { setCreating(true); setError(''); void createSession(projectId).then((created) => { setActiveSession(created); return listSessions(); }).then(setSessions).catch((reason: unknown) => setError(asError(reason))).finally(() => setCreating(false)); };
  const handleSend = (text: string) => { if (!activeSession) return; setError(''); setRunBySession((current) => ({ ...current, [activeSession.id]: { ...EMPTY_RUN, status: 'running', startedAt: Date.now(), currentAction: '正在启动 Codex', logs: [{ id: `${Date.now()}-start`, label: '正在启动 Codex' }] } })); void sendMessage(activeSession.id, text).catch((reason: unknown) => { setError(asError(reason)); setRunBySession((current) => ({ ...current, [activeSession.id]: { ...(current[activeSession.id] ?? EMPTY_RUN), status: 'error', currentAction: '启动失败' } })); }); };
  const handleStart = () => { if (!activeSession) return; setError(''); setRunBySession((current) => ({ ...current, [activeSession.id]: { ...EMPTY_RUN, status: 'running', startedAt: Date.now(), currentAction: '正在启动 Codex', logs: [{ id: `${Date.now()}-start`, label: '正在启动 Codex' }] } })); void startDevelopment(activeSession.id).catch((reason: unknown) => { setError(asError(reason)); setRunBySession((current) => ({ ...current, [activeSession.id]: { ...(current[activeSession.id] ?? EMPTY_RUN), status: 'error', currentAction: '启动失败' } })); }); };
  const handleStop = () => { if (activeSession) void stopDevelopment(activeSession.id).catch((reason: unknown) => setError(asError(reason))); };
  const canCreate = useMemo(() => projects.length > 0, [projects.length]);
  if (!activeSession) return <div className="development-workbench"><DevelopmentSessionList sessions={sessions} projects={projects} activeId="" onSelect={selectSession} onCreate={handleCreate} creating={creating} /><div className="development-empty-state">{canCreate ? '点击左侧 ＋ 创建开发会话' : '请先在项目管理中创建项目'}</div><DevelopmentRunPanel run={EMPTY_RUN} onStop={() => undefined} /></div>;
  return <div className="development-workbench"><DevelopmentSessionList sessions={sessions} projects={projects} activeId={activeSession.id} onSelect={selectSession} onCreate={handleCreate} creating={creating} /><DevelopmentChatPanel session={activeSession} runStatus={activeRun.status} error={error} onSend={handleSend} onStart={handleStart} /><DevelopmentRunPanel run={activeRun} onStop={handleStop} /></div>;
}
