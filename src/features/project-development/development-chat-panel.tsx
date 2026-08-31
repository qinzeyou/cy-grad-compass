import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Button, Input, Tag, Typography } from 'antd';
import { SendOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { DevelopmentSessionDetail, DevelopmentRunStatus } from './project-development-types';

type Props = { session: DevelopmentSessionDetail; runStatus: DevelopmentRunStatus; error: string; onSend: (message: string) => void; onStart: () => void };

// 中文注释：中间栏只负责消息展示与输入，运行状态由右侧面板独立呈现。
export function DevelopmentChatPanel({ session, runStatus, error, onSend, onStart }: Props): ReactElement {
  const [draft, setDraft] = useState(''); const endRef = useRef<HTMLDivElement>(null); const running = runStatus === 'running';
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session.messages.length]);
  const submit = () => { const value = draft.trim(); if (!value || running) return; onSend(value); setDraft(''); };
  return <section className="development-chat"><header className="development-chat-head"><div><Typography.Text className="eyebrow">{session.projectName}</Typography.Text><Typography.Title level={4}>{session.title}</Typography.Title></div><Tag color={session.phase === 'discussion' ? 'gold' : 'green'}>{session.phase === 'discussion' ? '需求讨论' : '开发执行'}</Tag></header><div className="message-scroll">{session.messages.length === 0 && <div className="chat-empty"><Typography.Title level={5}>先和 AI 讨论需求</Typography.Title><Typography.Text type="secondary">讨论阶段只读项目，确认后才允许写入。</Typography.Text></div>}{session.messages.map((item) => <div className={`message-row ${item.role}`} key={item.id}><div className="message-avatar">{item.role === 'user' ? '你' : 'AI'}</div><div className="message-body"><Typography.Text type="secondary">{item.role === 'user' ? '你' : 'Codex'}</Typography.Text><Typography.Paragraph>{item.content}</Typography.Paragraph></div></div>)}<div ref={endRef} /></div><div className="composer-wrap"><Input.TextArea value={draft} onChange={(event) => setDraft(event.target.value)} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); submit(); } }} placeholder={session.phase === 'discussion' ? '描述需求，先让 AI 分析项目...' : '继续告诉 AI 下一步要做什么...'} autoSize={{ minRows: 3, maxRows: 6 }} disabled={running} /><div className="composer-actions"><Typography.Text type="secondary">Enter 发送 · Shift + Enter 换行</Typography.Text><div><Button onClick={submit} disabled={running || !draft.trim()} icon={<SendOutlined />}>发送</Button>{session.phase === 'discussion' && <Button type="primary" onClick={onStart} disabled={running || session.codexThreadId === null} icon={<PlayCircleOutlined />}>开始开发</Button>}</div></div>{error && <Typography.Text type="danger">{error}</Typography.Text>}</div></section>;
}
