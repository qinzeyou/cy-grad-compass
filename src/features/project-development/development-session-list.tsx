import type { ReactElement } from 'react';
import type { Project } from '../project-statistics/project-statistics-types';
import type { DevelopmentSession } from './project-development-types';

type Props = {
  sessions: DevelopmentSession[];
  projects: Project[];
  selectedProjectId: string;
  activeId: string;
  onProjectSelect: (projectId: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating: boolean;
};
const PHASE_LABELS = { discussion: '需求讨论', development: '开发执行' } as const;

// 中文注释：先选择项目，再显示该项目的会话，避免未绑定项目时误发起 AI 对话。
export function DevelopmentSessionList({ sessions, projects, selectedProjectId, activeId, onProjectSelect, onSelect, onCreate, creating }: Props): ReactElement {
  return <aside className="development-sessions"><div className="development-sidebar-head"><div><span className="eyebrow">PROJECT DEVELOPMENT</span><h2>项目开发</h2></div><button className="icon-button" type="button" onClick={onCreate} aria-label="新建开发会话" disabled={!selectedProjectId || creating}>＋</button></div><div className="project-select-wrap"><label htmlFor="development-project">当前项目</label><select id="development-project" value={selectedProjectId} onChange={(event) => onProjectSelect(event.target.value)} disabled={creating}><option value="">请选择项目</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>{selectedProjectId && <div className="session-list">{sessions.map((session) => <button className={session.id === activeId ? 'session-item active' : 'session-item'} key={session.id} type="button" onClick={() => onSelect(session.id)} aria-current={session.id === activeId ? 'page' : undefined}><span className="session-status" /><span className="session-copy"><strong>{session.title}</strong><small>{PHASE_LABELS[session.phase]}</small></span></button>)}{sessions.length === 0 && <div className="session-empty">还没有开发会话<br /><span>点击右上角 ＋ 新建</span></div>}</div>}<div className="development-sidebar-foot">{selectedProjectId ? '本机 Codex · 工作区权限受限' : '请选择项目后开始对话'}</div></aside>;
}
