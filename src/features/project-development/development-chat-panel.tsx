import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { DevelopmentSession } from './project-development-types';

type Props = {
  session: DevelopmentSession;
  onSend: (message: string) => void;
  onStart: () => void;
};

// 中文注释：中间栏只负责消息展示和输入，不关心模拟运行的具体步骤。
export function DevelopmentChatPanel({ session, onSend, onStart }: Props): ReactElement {
  const [draft, setDraft] = useState('');
  const messageEndRef = useRef<HTMLDivElement>(null);
  const isRunning = session.run.status === 'queued' || session.run.status === 'running';

  useEffect(() => { messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session.messages.length]);

  const submit = () => {
    const message = draft.trim();
    if (!message) return;
    onSend(message);
    setDraft('');
  };

  return (
    <section className="development-chat">
      <header className="development-chat-head"><div><span className="eyebrow">CHAT SESSION</span><h2>{session.title}</h2></div><span className="simulation-tag">模拟模式</span></header>
      <div className="message-scroll">
        {session.messages.length === 0 && <div className="chat-empty"><div className="chat-empty-mark">◎</div><strong>描述你想开发的功能</strong><p>这是模拟对话，确认后只演示 Agent 运行状态。</p><div className="prompt-chip">例如：设计一个项目列表页面</div></div>}
        {session.messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}><div className="message-avatar">{message.role === 'user' ? '你' : 'AI'}</div><div className="message-body"><span className="message-author">{message.role === 'user' ? '你' : 'AI 助手'}</span><p>{message.content}</p></div></div>)}
        <div ref={messageEndRef} />
      </div>
      <div className="composer-wrap">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="描述你的开发需求..." rows={3} disabled={isRunning} />
        <div className="composer-actions"><small>Enter 发送 · Shift + Enter 换行</small><div><button className="secondary-button compact" type="button" onClick={submit} disabled={isRunning || !draft.trim()}>发送</button><button className="primary-button compact" type="button" onClick={onStart} disabled={isRunning || session.messages.length === 0}>开始开发 <span>→</span></button></div></div>
      </div>
    </section>
  );
}
