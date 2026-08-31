import { useState, type ReactElement } from 'react';
import { Button, Input, Modal, Select, Typography } from 'antd';
import { FolderOpenOutlined, CodeOutlined, EditOutlined, InboxOutlined } from '@ant-design/icons';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS, type Project, type ProjectStatus } from '../project-statistics/project-statistics-types';

interface ProjectRowProps { project: Project; busy: boolean; onStatusChange: (project: Project, next: ProjectStatus) => void; onRename: (project: Project, newName: string) => Promise<void>; onArchive: (project: Project) => void; onOpenPath: (project: Project) => void; onDevelop: (project: Project) => void; }
// 中文注释：项目行展示状态和常用操作，危险归档交由父组件确认后执行。
export function ProjectRow({ project, busy, onStatusChange, onRename, onArchive, onOpenPath, onDevelop }: ProjectRowProps): ReactElement {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(project.name);
  const save = async () => { const name = draft.trim(); if (!name || name === project.name) return setEditing(false); await onRename(project, name); setEditing(false); };
  return <li className="project-row"><div className="project-name-cell">{editing ? <Input size="small" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onPressEnter={() => void save()} onBlur={() => void save()} /> : <Typography.Text strong>{project.name}</Typography.Text>}</div><Select size="small" value={project.status} disabled={busy} onChange={(value) => onStatusChange(project, value)} options={PROJECT_STATUSES.map((value) => ({ value, label: PROJECT_STATUS_LABELS[value] }))} /><div className="row-actions"><Button size="small" type="primary" ghost icon={<CodeOutlined />} onClick={() => onDevelop(project)} disabled={busy}>开发</Button><Button size="small" icon={<EditOutlined />} onClick={() => { setDraft(project.name); setEditing(true); }} disabled={busy}>重命名</Button><Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenPath(project)} disabled={busy}>目录</Button>{project.status !== 'archived' && <Button size="small" danger icon={<InboxOutlined />} onClick={() => Modal.confirm({ title: '归档项目', content: `确定归档项目「${project.name}」吗？`, okText: '归档', cancelText: '取消', onOk: () => onArchive(project) })} disabled={busy}>归档</Button>}</div></li>;
}
