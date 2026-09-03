import { useEffect, useRef, useState, type ElementType, type ReactElement, type ReactNode } from 'react';
import { Button, Input, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, PlayCircleOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { DevelopmentSessionDetail, DevelopmentRunStatus } from './project-development-types';

type Props = { session: DevelopmentSessionDetail; runStatus: DevelopmentRunStatus; error: string; onSend: (message: string) => void; onStart: () => void };

function inlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > offset) parts.push(text.slice(offset, start));
    if (token.startsWith('**')) parts.push(<strong key={`${start}-strong`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) parts.push(<code key={`${start}-code`}>{token.slice(1, -1)}</code>);
    else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link) parts.push(<a key={`${start}-link`} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>);
    }
    offset = start + token.length;
  }
  if (offset < text.length) parts.push(text.slice(offset));
  return parts;
}

export function MarkdownContent({ content }: { content: string }): ReactElement {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) { index += 1; continue; }
    if (line.trim().startsWith('```')) {
      const code: string[] = []; index += 1;
      while (index < lines.length && !lines[index]?.trim().startsWith('```')) { code.push(lines[index] ?? ''); index += 1; }
      index += 1; blocks.push(<pre key={`code-${index}`}><code>{code.join('\n')}</code></pre>); continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { const Tag = `h${heading[1].length}` as ElementType; blocks.push(<Tag key={`heading-${index}`}>{inlineMarkdown(heading[2])}</Tag>); index += 1; continue; }
    const listPattern = /^\s*([-*]|\d+\.)\s+(.+)$/; const listMatch = listPattern.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]); const items: string[] = [];
      while (index < lines.length) { const item = listPattern.exec(lines[index] ?? ''); if (!item || /\d+\./.test(item[1]) !== ordered) break; items.push(item[2]); index += 1; }
      const List = ordered ? 'ol' : 'ul'; blocks.push(<List key={`list-${index}`}>{items.map((item, itemIndex) => <li key={`${index}-${itemIndex}`}>{inlineMarkdown(item)}</li>)}</List>); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && (lines[index] ?? '').trim() && !/^(#{1,6})\s+/.test(lines[index] ?? '') && !listPattern.test(lines[index] ?? '') && !(lines[index] ?? '').trim().startsWith('```')) { paragraph.push(lines[index] ?? ''); index += 1; }
    blocks.push(<p key={`paragraph-${index}`}>{inlineMarkdown(paragraph.join(' '))}</p>);
  }
  return <div className="markdown-content">{blocks}</div>;
}

// 中文注释：中间栏只负责消息展示与输入，运行状态由右侧面板独立呈现。
export function DevelopmentChatPanel({ session, runStatus, error, onSend, onStart }: Props): ReactElement {
  const [draft, setDraft] = useState(''); const endRef = useRef<HTMLDivElement>(null); const running = runStatus === 'running';
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [session.messages.length]);
  const submit = () => { const value = draft.trim(); if (!value || running) return; onSend(value); setDraft(''); };
  return <section className="development-chat"><header className="development-chat-head"><Typography.Title level={5} className="chat-title">{session.title}</Typography.Title></header><div className="message-scroll">{session.messages.length === 0 && <div className="chat-empty"><Typography.Title level={5}>先和 AI 讨论需求</Typography.Title></div>}{session.messages.map((item) => <div className={`message-row edge-aligned ${item.role}`} key={item.id}><div className="message-avatar">{item.role === 'user' ? '你' : 'AI'}</div><div className="message-body"><Typography.Text type="secondary">{item.role === 'user' ? '你' : 'AI'}</Typography.Text><div className="message-bubble">{item.role === 'assistant' ? <MarkdownContent content={item.content} /> : <Typography.Paragraph>{item.content}</Typography.Paragraph>}</div></div></div>)}<div ref={endRef} /></div><div className="composer-wrap"><div className="composer-input-shell"><Input.TextArea className="composer-input" value={draft} onChange={(event) => setDraft(event.target.value)} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="随心输入" autoSize={{ minRows: 3, maxRows: 6 }} disabled={running} /><div className="composer-footer"><div className="composer-footer-left"><span className="composer-add" aria-hidden="true"><PlusOutlined /></span><Typography.Text className="composer-access"><SafetyCertificateOutlined />完全访问</Typography.Text>{session.phase === 'discussion' && <Tooltip title="开始开发"><Button type="text" className="composer-start" aria-label="开始开发" onClick={onStart} disabled={running || session.codexThreadId === null} icon={<PlayCircleOutlined />} /></Tooltip>}</div><div className="composer-footer-right"><Typography.Text className="composer-model">5.6 Sol <span>高</span></Typography.Text><Button type="primary" shape="circle" className="composer-send" aria-label="发送" onClick={submit} disabled={running || !draft.trim()} icon={<ArrowUpOutlined />} /></div></div></div>{error && <Typography.Text type="danger">{error}</Typography.Text>}</div></section>;
}
