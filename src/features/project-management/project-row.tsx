import { useState, type KeyboardEvent, type ReactElement } from 'react';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
} from '../project-statistics/project-statistics-types';

interface ProjectRowProps {
  project: Project;
  busy: boolean;
  onStatusChange: (project: Project, next: ProjectStatus) => void;
  onRename: (project: Project, newName: string) => Promise<void>;
  onArchive: (project: Project) => void;
  onOpenPath: (project: Project) => void;
  onDevelop: (project: Project) => void;
}

// 中文注释：单条项目展示行，包含名称、状态、目录管理和进入 AI 开发工作台的入口。
export function ProjectRow({ project, busy, onStatusChange, onRename, onArchive, onOpenPath, onDevelop }: ProjectRowProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [renameError, setRenameError] = useState<string | null>(null);

  const startEditing = () => {
    setDraftName(project.name);
    setRenameError(null);
    setEditing(true);
  };

  const saveRename = async () => {
    const nextName = draftName.trim();
    if (nextName === '' || nextName === project.name) {
      setEditing(false);
      return;
    }
    try {
      await onRename(project, nextName);
      setEditing(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : '重命名失败，请重试');
    }
  };

  const handleRenameKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      void saveRename();
    } else if (event.key === 'Escape') {
      setEditing(false);
    }
  };

  return (
    <li className="project-row">
      <div className="project-name-cell">
        {editing ? (
          <div className="rename-field">
            <input
              className="rename-input"
              type="text"
              value={draftName}
              maxLength={80}
              autoFocus
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={handleRenameKey}
              onBlur={() => void saveRename()}
              aria-label={`修改「${project.name}」的名称`}
            />
            {renameError !== null && <span className="rename-error">{renameError}</span>}
          </div>
        ) : (
          <>
            <strong>{project.name}</strong>
            <span className="project-id">{project.id}</span>
          </>
        )}
      </div>
      <div className="project-status-cell">
        <select
          className="status-select"
          value={project.status}
          disabled={busy}
          onChange={(event) => onStatusChange(project, event.target.value as ProjectStatus)}
          aria-label={`修改「${project.name}」的状态`}
        >
          {PROJECT_STATUSES.map((option) => (
            <option key={option} value={option}>{PROJECT_STATUS_LABELS[option]}</option>
          ))}
        </select>
      </div>
      <div className="project-path-cell">
        <span className="recent-path" title={project.path}>{project.path}</span>
      </div>
      <div className="project-date-cell">
        <time dateTime={project.createdAt} title="创建时间">建 {formatDate(project.createdAt)}</time>
        <time dateTime={project.updatedAt} title="更新时间">更 {formatDate(project.updatedAt)}</time>
      </div>
      <div className="row-actions">
        <button className="text-button develop-action" type="button" onClick={() => onDevelop(project)} disabled={busy}>进入开发</button>
        <button className="text-button" type="button" onClick={startEditing} disabled={busy}>重命名</button>
        <button className="text-button" type="button" onClick={() => onOpenPath(project)} disabled={busy}>打开目录</button>
        {project.status !== 'archived' && (
          <button className="text-button danger" type="button" onClick={() => onArchive(project)} disabled={busy}>
            归档
          </button>
        )}
      </div>
    </li>
  );
}

// 中文注释：ISO 字符串只取本地日期部分展示，避免时区细节影响可读性。
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
