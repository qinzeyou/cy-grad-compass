import { Button, Dropdown, Empty, Popconfirm, Tooltip, Typography } from 'antd';
import { DeleteOutlined, FolderAddOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { useState, type ReactElement } from 'react';
import type { Project } from '../project-statistics/project-statistics-types';
import type { DevelopmentSession } from './project-development-types';

type Props = { sessions: DevelopmentSession[]; projects: Project[]; selectedWorkspaceId: string; activeId: string; onWorkspaceSelect: (workspaceId: string) => void; onWorkspaceAdd: () => void; onWorkspaceOpen: (workspace: Project) => void; onWorkspaceDelete: (workspace: Project) => void; onSelect: (id: string) => void; onCreate: (workspaceId?: string) => void; onDelete: (session: DevelopmentSession) => void; onReorder: (workspaceId: string, sessionIds: string[]) => void; creating: boolean };

// 中文注释：左栏按工作区分组显示会话，工作区实际复用项目目录，避免引入新的持久化模型。
export function DevelopmentSessionList({ sessions, projects, selectedWorkspaceId, activeId, onWorkspaceSelect, onWorkspaceAdd, onWorkspaceOpen, onWorkspaceDelete, onSelect, onCreate, onDelete, onReorder, creating }: Props): ReactElement {
  const [dragging, setDragging] = useState<{ workspaceId: string; sessionId: string } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const finishDrag = () => { setDragging(null); setDragOverId(null); };
  const dropSession = (workspaceId: string, targetId: string) => {
    if (dragging === null || dragging.workspaceId !== workspaceId || dragging.sessionId === targetId) { finishDrag(); return; }
    const workspaceSessions = sessions.filter((session) => session.projectId === workspaceId);
    const nextIds = workspaceSessions.map((session) => session.id).filter((id) => id !== dragging.sessionId);
    const targetIndex = nextIds.indexOf(targetId);
    if (targetIndex < 0) { finishDrag(); return; }
    nextIds.splice(targetIndex + 1, 0, dragging.sessionId);
    onReorder(workspaceId, nextIds);
    finishDrag();
  };

  return <aside className="development-sessions reference-sidebar"><div className="development-sidebar-toolbar"><Button icon={<FolderAddOutlined />} onClick={onWorkspaceAdd} disabled={creating}>新增工作区</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => onCreate()} disabled={!selectedWorkspaceId || creating}>新建会话</Button></div><div className="workspace-list">{projects.map((workspace) => { const workspaceSessions = sessions.filter((session) => session.projectId === workspace.id); const selected = workspace.id === selectedWorkspaceId; const menu = { items: [{ key: 'open', label: '资源浏览器打开', icon: <FolderOpenOutlined /> }, { type: 'divider' as const }, { key: 'delete', label: '删除', danger: true, icon: <DeleteOutlined /> }], onClick: ({ key }: { key: string }) => { if (key === 'open') onWorkspaceOpen(workspace); if (key === 'delete') onWorkspaceDelete(workspace); } }; return <section className={selected ? 'workspace-group selected' : 'workspace-group'} key={workspace.id} data-workspace-id={workspace.id}><Dropdown menu={menu} trigger={['contextMenu']}><div className="workspace-item"><Button type="text" className="workspace-select" onClick={() => onWorkspaceSelect(workspace.id)}><FolderOutlined /><span className="workspace-name">{workspace.name}</span></Button><Tooltip title="在此工作区新建会话"><Button type="text" className="workspace-create" icon={<PlusOutlined />} aria-label={`在工作区 ${workspace.name} 新建会话`} onClick={() => onCreate(workspace.id)} disabled={creating} /></Tooltip></div></Dropdown><div className="workspace-session-list">{workspaceSessions.map((session) => <div key={session.id} data-session-id={session.id} draggable className={`${session.id === activeId ? 'session-item active' : 'session-item'}${dragOverId === session.id ? ' drag-over' : ''}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragging({ workspaceId: workspace.id, sessionId: session.id }); }} onDragOver={(event) => { if (dragging?.workspaceId === workspace.id) { event.preventDefault(); setDragOverId(session.id); } }} onDrop={(event) => { event.preventDefault(); dropSession(workspace.id, session.id); }} onDragEnd={finishDrag} aria-label={`可拖动会话 ${session.title}`}><Button type="text" className="session-select" onClick={() => onSelect(session.id)}><span className="session-copy"><strong className="session-name">{session.title}</strong></span></Button><Popconfirm title="删除会话" description={`确定删除会话「${session.title}」吗？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => onDelete(session)}><Button type="text" danger className="session-delete" icon={<DeleteOutlined />} aria-label={`删除会话 ${session.title}`} /></Popconfirm></div>)}</div>{workspaceSessions.length === 0 && <Typography.Text type="secondary" className="workspace-empty">暂无会话，点击右侧 + 新建</Typography.Text>}</section>; })}{projects.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击“新增工作区”开始" />}</div></aside>;
}
