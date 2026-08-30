import type { ReactElement } from 'react';
import { PROJECT_STATUS_LABELS, type RecentProject } from './project-statistics-types';

export type EmptyAction = 'import-template' | 'create-project';

interface RecentProjectListProps {
  projects: RecentProject[];
  onEmptyAction: (action: EmptyAction) => void;
  onOpenPath: (project: RecentProject) => void;
}

// 中文注释：最近 5 个项目列表；没有项目时展示空状态和新建入口。
export function RecentProjectList({ projects, onEmptyAction, onOpenPath }: RecentProjectListProps): ReactElement {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">＋</div>
        <strong>还没有毕业项目</strong>
        <p>导入模板后，创建你的第一个项目。</p>
        <div className="empty-actions">
          <button className="secondary-button" type="button" onClick={() => onEmptyAction('import-template')}>
            导入代码模板
          </button>
          <button className="secondary-button ghost" type="button" onClick={() => onEmptyAction('create-project')}>
            新建项目
          </button>
        </div>
      </div>
    );
  }

  return (
    <ul className="recent-list">
      {projects.map((project) => (
        <li className="recent-row" key={project.id}>
          <div className="recent-main">
            <strong>{project.name}</strong>
            <span className={`status-badge ${project.status}`}>{PROJECT_STATUS_LABELS[project.status]}</span>
          </div>
          <div className="recent-meta">
            <span className="recent-path" title={project.path}>{project.path}</span>
            <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
          </div>
          <button className="text-button" type="button" onClick={() => onOpenPath(project)}>
            打开目录
          </button>
        </li>
      ))}
    </ul>
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
