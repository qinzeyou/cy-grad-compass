import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DevelopmentChatPanel } from './development-chat-panel';
import { DevelopmentRunPanel } from './development-run-panel';
import { DevelopmentSessionList } from './development-session-list';

const session = { id: 'session-1', projectId: 'project-1', projectName: '示例项目', title: '需求讨论', codexThreadId: null, phase: 'discussion' as const, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' };
Element.prototype.scrollIntoView = () => undefined;

describe('project development layout', () => {
  test('keeps session actions inside the row and renders role bubbles', () => {
    const sessionView = render(<DevelopmentSessionList sessions={[session]} projects={[{ id: 'project-1', name: '示例项目', path: 'C:\\project', status: 'in-progress', templateId: 'default', createdAt: session.createdAt, updatedAt: session.updatedAt }]} workspaceIds={['project-1']} selectedWorkspaceId="project-1" activeId="session-1" onWorkspaceSelect={() => undefined} onWorkspaceAdd={() => undefined} onSelect={() => undefined} onCreate={() => undefined} onDelete={() => undefined} creating={false} />);
    expect(sessionView.container.querySelector('.session-item .session-delete')).not.toBeNull();
    expect(sessionView.container.querySelector('.workspace-item')).not.toBeNull();
    expect(sessionView.container.querySelector('.development-sessions.reference-sidebar')).not.toBeNull();
    expect(sessionView.container.querySelector('.workspace-name')?.textContent).toBe('示例项目');
    expect(sessionView.container.querySelector('.session-copy strong.session-name')?.textContent).toBe('需求讨论');
    expect(sessionView.container.querySelector('.session-copy small')).toBeNull();
    expect(sessionView.container.querySelector('.session-status')).toBeNull();
    expect(sessionView.getByRole('button', { name: /新增工作区/ })).toBeTruthy();
    expect(within(sessionView.container.querySelector('.development-sidebar-toolbar') as HTMLElement).getByRole('button', { name: /新建会话/ })).toBeTruthy();

    const chat = render(<DevelopmentChatPanel session={{ ...session, messages: [{ id: 'message-1', sessionId: session.id, role: 'user', content: '你好', createdAt: session.createdAt }, { id: 'message-2', sessionId: session.id, role: 'assistant', content: '## 结果\n\n- 已完成\n\n`npm test`', createdAt: session.createdAt }] }} runStatus="idle" error="" onSend={() => undefined} onStart={() => undefined} />);
    expect(chat.container.querySelector('.message-row.user .message-bubble')).not.toBeNull();
    expect(chat.container.querySelector('.message-scroll .message-row.edge-aligned')).not.toBeNull();
    expect(chat.container.querySelector('.message-row.user')?.textContent).toContain('你好');
    expect(chat.container.querySelector('.message-row.assistant h2')?.textContent).toBe('结果');
    expect(chat.container.querySelectorAll('.message-row.assistant li')).toHaveLength(1);
    expect(chat.container.querySelector('.message-row.assistant code')?.textContent).toBe('npm test');
    expect(chat.container.querySelector('.message-scroll')).not.toBeNull();
    expect(chat.container.querySelector('.development-chat-head .eyebrow')).toBeNull();
    expect(chat.container.querySelector('.development-chat-head .ant-tag')).toBeNull();
    expect(chat.container.querySelector('.development-chat-head h5')?.textContent).toBe('需求讨论');
    expect(chat.container.querySelector('.composer-input-shell')).not.toBeNull();
    expect(chat.container.querySelector('.composer-footer')).not.toBeNull();
    expect(chat.container.querySelector('.composer-add')).not.toBeNull();
    expect(chat.container.querySelector('.composer-send')).not.toBeNull();
    expect(chat.container.querySelector('.composer-shortcuts')).toBeNull();
  });

  test('opens the workspace menu even when every project is already a workspace', () => {
    const onWorkspaceAdd = vi.fn();
    const view = render(<DevelopmentSessionList sessions={[session]} projects={[{ id: 'project-1', name: '示例项目', path: 'C:\\project', status: 'in-progress', templateId: 'default', createdAt: session.createdAt, updatedAt: session.updatedAt }]} workspaceIds={['project-1']} selectedWorkspaceId="project-1" activeId="session-1" onWorkspaceSelect={() => undefined} onWorkspaceAdd={onWorkspaceAdd} onSelect={() => undefined} onCreate={() => undefined} onDelete={() => undefined} creating={false} />);

    fireEvent.click(view.getByRole('button', { name: /新增工作区/ }));

    const menuItem = view.getByRole('menuitem', { name: /示例项目/ });
    expect(menuItem).toBeTruthy();
    fireEvent.click(menuItem);
    expect(onWorkspaceAdd).toHaveBeenCalledWith('project-1');
  });

  test('offers pause while running and continue after pausing', () => {
    const onPause = vi.fn();
    const onContinue = vi.fn();
    const run = { status: 'running' as const, startedAt: Date.now(), commandCount: 0, changedPaths: [], currentAction: '执行中', logs: [] };
    const runningView = render(<DevelopmentRunPanel run={run} onPause={onPause} onContinue={onContinue} />);
    fireEvent.click(runningView.getByRole('button', { name: /暂停开发/ }));
    expect(onPause).toHaveBeenCalledOnce();

    runningView.rerender(<DevelopmentRunPanel run={{ ...run, status: 'paused' }} onPause={onPause} onContinue={onContinue} />);
    fireEvent.click(runningView.getByRole('button', { name: /继续开发/ }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
