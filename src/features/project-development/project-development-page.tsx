import { useEffect, useRef, useState, type ReactElement } from 'react';
import { DevelopmentChatPanel } from './development-chat-panel';
import { DevelopmentRunPanel } from './development-run-panel';
import { DevelopmentSessionList } from './development-session-list';
import type { ChatMessage, DevelopmentSession, RunStatus } from './project-development-types';
import './project-development.css';

const RUN_STEPS = ['分析需求', '编写代码', '运行检查', '整理结果'];
const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
const message = (role: ChatMessage['role'], content: string): ChatMessage => ({ id: `${Date.now()}-${Math.random()}`, role, content, createdAt: new Date().toISOString() });
const emptySession = (index: number): DevelopmentSession => ({ id: `${Date.now()}-${index}`, title: `未命名会话 ${index}`, updatedAt: now(), messages: [], run: { status: 'idle', progress: 0, currentAction: '等待你的开发需求', logs: ['模拟执行器已就绪'] } });

// 中文注释：页面容器集中管理会话和单个定时器，避免切换会话时出现串线更新。
export function ProjectDevelopmentPage(): ReactElement {
  const [sessions, setSessions] = useState<DevelopmentSession[]>(() => [emptySession(1)]);
  const [activeId, setActiveId] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeSession = sessions.find((session) => session.id === activeId) ?? sessions[0];

  useEffect(() => { if (!activeId && sessions[0]) setActiveId(sessions[0].id); }, [activeId, sessions]);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const updateActive = (update: (session: DevelopmentSession) => DevelopmentSession) => setSessions((current) => current.map((session) => session.id === activeSession?.id ? update(session) : session));

  const createSession = () => { const created = emptySession(sessions.length + 1); setSessions((current) => [created, ...current]); setActiveId(created.id); };
  const sendMessage = (content: string) => {
    updateActive((session) => ({ ...session, title: session.messages.length === 0 ? content.slice(0, 22) : session.title, updatedAt: now(), messages: [...session.messages, message('user', content)] }));
    window.setTimeout(() => updateActive((session) => ({ ...session, updatedAt: now(), messages: [...session.messages, message('assistant', '这是模拟回复：我已理解你的需求。点击“开始开发”后，将演示 Agent 的分析、编写和检查流程。')] })), 700);
  };
  const startRun = () => {
    if (!activeSession || activeSession.run.status === 'queued' || activeSession.run.status === 'running') return;
    if (timerRef.current) clearInterval(timerRef.current);
    let step = -1;
    updateActive((session) => ({ ...session, run: { status: 'queued', progress: 5, currentAction: '等待 Agent 启动', logs: [...session.run.logs, '已创建模拟开发任务'] } }));
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= RUN_STEPS.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        updateActive((session) => ({ ...session, updatedAt: now(), run: { ...session.run, status: 'completed', progress: 100, currentAction: '模拟开发已完成', logs: [...session.run.logs, '模拟开发已完成'] } }));
        return;
      }
      const progress = 25 + step * 23;
      updateActive((session) => ({ ...session, updatedAt: now(), run: { ...session.run, status: 'running', progress, currentAction: RUN_STEPS[step], logs: [...session.run.logs, `Agent：${RUN_STEPS[step]}`] } }));
    }, 900);
  };
  const stopRun = () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; updateActive((session) => ({ ...session, run: { ...session.run, status: 'stopped' as RunStatus, currentAction: '已停止本次模拟运行', logs: [...session.run.logs, '用户停止了模拟运行'] } })); };

  if (!activeSession) return <div className="development-workbench" />;
  return <div className="development-workbench"><DevelopmentSessionList sessions={sessions} activeId={activeSession.id} onSelect={(id) => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } setActiveId(id); }} onCreate={createSession} /><DevelopmentChatPanel session={activeSession} onSend={sendMessage} onStart={startRun} /><DevelopmentRunPanel run={activeSession.run} onStop={stopRun} /></div>;
}
