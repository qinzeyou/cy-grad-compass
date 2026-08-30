import { useState, type ReactElement } from 'react';
import type { Project } from '../project-statistics/project-statistics-types';
import type { DevelopmentSession } from './project-development-types';

type Props = { sessions: DevelopmentSession[]; projects: Project[]; activeId: string; onSelect: (id: string) => void; onCreate: (projectId: string) => void; creating: boolean };
const PHASE_LABELS = { discussion: '需求讨论', development: '开发执行' } as const;

// 中文注释：左栏管理会话导航和项目选择，创建动作交给页面容器调用主进程。
export function DevelopmentSessionList({ sessions, projects, activeId, onSelect, onCreate, creating }: Props): ReactElement {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const create = () => { if (projectId) { onCreate(projectId); setPickerOpen(false); } };
  return <aside className="development-sessions"><div className="development-sidebar-head"><div><span className="eyebrow">PROJECT DEVELOPMENT</span><h2>开发会话</h2></div><button className="icon-button" type="button" onClick={() => setPickerOpen((open) => !open)} aria-label="新建开发会话">＋</button></div>{pickerOpen && <div className="session-create"><label htmlFor="development-project">选择项目</label><select id="development-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={creating}><option value="">请选择</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button className="primary-button compact" type="button" onClick={create} disabled={creating || !projectId}>{creating ? '创建中' : '创建会话'}</button></div>}<div className="session-list">{sessions.map((session) => <button className={session.id === activeId ? 'session-item active' : 'session-item'} key={session.id} type="button" onClick={() => onSelect(session.id)} aria-current={session.id === activeId ? 'page' : undefined}><span className="session-status" /><span className="session-copy"><strong>{session.title}</strong><small>{session.projectName} · {PHASE_LABELS[session.phase]}</small></span></button>)}</div><div className="development-sidebar-foot">本机 Codex · 工作区权限受限</div></aside>;
}
