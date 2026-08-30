import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { DevelopmentSessionDetail, DevelopmentRunStatus } from './project-development-types';

type Props = { session: DevelopmentSessionDetail; runStatus: DevelopmentRunStatus; error: string; onSend: (message: string) => void; onStart: () => void };

// 中文注释：中间栏只负责持久化消息展示和输入，运行事件由右栏消费。
export function DevelopmentChatPanel({ session, runStatus, error, onSend, onStart }: Props): ReactElement {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const running = runStatus === 'running';
  const submit = () => { const value = draft.trim(); if (!value || running) return; onSend(value); setDraft(''); };
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session.messages.length]);
  return <section className="development-chat"><header className="development-chat-head"><div><span className="eyebrow">{session.projectName}</span><h2>{session.title}</h2></div><span className="simulation-tag">{session.phase === 'discussion' ? '需求讨论' : '开发执行'}</span></header><div className="message-scroll">{session.messages.length === 0 && <div className="chat-empty"><div className="chat-empty-mark">◎</div><strong>先和 AI 讨论需求</strong><p>讨论阶段只读项目，确认后才允许写入。</p></div>}{session.messages.map((item) => <div className={`message-row ${item.role}`} key={item.id}><div className="message-avatar">{item.role === 'user' ? '你' : 'AI'}</div><div className="message-body"><span className="message-author">{item.role === 'user' ? '你' : 'Codex'}</span><p>{item.content}</p></div></div>)}<div ref={endRef} /></div>{error && <div className="development-error">{error}</div>}<div className="composer-wrap"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={session.phase === 'discussion' ? '描述需求，先让 AI 分析项目...' : '继续告诉 AI 下一步要做什么...'} rows={3} disabled={running} /><div className="composer-actions"><small>Enter 发送 · Shift + Enter 换行</small><div><button className="secondary-button compact" type="button" onClick={submit} disabled={running || !draft.trim()}>发送</button>{session.phase === 'discussion' && <button className="primary-button compact" type="button" onClick={onStart} disabled={running || session.codexThreadId === null}>开始开发 <span>→</span></button>}</div></div></div></section>;
}
