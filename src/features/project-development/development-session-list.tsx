import { Button, Empty, Modal, Select, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ReactElement } from 'react';
import type { Project } from '../project-statistics/project-statistics-types';
import type { DevelopmentSession } from './project-development-types';

type Props = { sessions: DevelopmentSession[]; projects: Project[]; selectedProjectId: string; activeId: string; onProjectSelect: (projectId: string) => void; onSelect: (id: string) => void; onCreate: () => void; onDelete: (session: DevelopmentSession) => void; creating: boolean };
const PHASE_LABELS = { discussion: '需求讨论', development: '开发执行' } as const;

// 中文注释：左栏负责选择项目与会话，未选择项目时禁用新建会话按钮。
export function DevelopmentSessionList({ sessions, projects, selectedProjectId, activeId, onProjectSelect, onSelect, onCreate, onDelete, creating }: Props): ReactElement {
  return <aside className="development-sessions"><div className="development-sidebar-head"><div><Typography.Text className="eyebrow">PROJECT DEVELOPMENT</Typography.Text><Typography.Title level={4}>开发会话</Typography.Title></div><Button type="primary" shape="circle" icon={<PlusOutlined />} onClick={onCreate} disabled={!selectedProjectId || creating} /></div><div className="project-select-wrap"><Typography.Text type="secondary">当前项目</Typography.Text><Select value={selectedProjectId || undefined} placeholder="请选择项目" options={projects.map((project) => ({ value: project.id, label: project.name }))} onChange={onProjectSelect} disabled={creating} /></div><div className="session-list">{selectedProjectId ? sessions.map((session) => <div key={session.id} className="session-row"><Button type="text" className={session.id === activeId ? 'session-item active' : 'session-item'} onClick={() => onSelect(session.id)}><span className="session-status" /><span className="session-copy"><strong>{session.title}</strong><small>{PHASE_LABELS[session.phase]}</small></span></Button><Button type="text" danger className="session-delete" icon={<DeleteOutlined />} aria-label={`删除会话 ${session.title}`} onClick={() => Modal.confirm({ title: '删除会话', content: `确定删除会话「${session.title}」吗？`, okText: '删除', cancelText: '取消', okButtonProps: { danger: true }, onOk: () => onDelete(session) })} /></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择项目后开始" />}{selectedProjectId && sessions.length === 0 && <Typography.Text type="secondary" className="session-empty">还没有开发会话，点击右上角新建</Typography.Text>}</div><div className="development-sidebar-foot">{!selectedProjectId && '请选择项目后开始对话'}</div></aside>;
}
