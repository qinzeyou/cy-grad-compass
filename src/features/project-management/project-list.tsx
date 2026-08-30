import type { ReactElement } from 'react';
import {
  PROJECT_FILTER_LABELS,
  type Project,
  type ProjectStatus,
  type ProjectStatusFilter,
} from '../project-statistics/project-statistics-types';
import { ProjectRow } from './project-row';

type LoadState = 'loading' | 'ready' | 'error';

interface ProjectListProps {
  loadState: LoadState;
  projects: Project[];
  keyword: string;
  status: ProjectStatusFilter;
  busyProjectId: string | null;
  onKeywordChange: (keyword: string) => void;
  onStatusChange: (status: ProjectStatusFilter) => void;
  onClearFilters: () => void;
  onRetry: () => void;
  onStatusChangeForProject: (project: Project, next: ProjectStatus) => void;
  onRenameProject: (project: Project, newName: string) => Promise<void>;
  onArchiveProject: (project: Project) => void;
  onOpenPath: (project: Project) => void;
  onDevelop: (project: Project) => void;
  onImportTemplate: () => void;
  onCreateProject: () => void;
}

// 中文注释：项目列表容器，负责搜索、状态筛选、清空筛选以及各种列表状态（无数据/无匹配/加载失败）。
export function ProjectList({
  loadState,
  projects,
  keyword,
  status,
  busyProjectId,
  onKeywordChange,
  onStatusChange,
  onClearFilters,
  onRetry,
  onStatusChangeForProject,
  onRenameProject,
  onArchiveProject,
  onOpenPath,
  onDevelop,
  onImportTemplate,
  onCreateProject,
}: ProjectListProps): ReactElement {
  const hasActiveFilter = keyword.trim() !== '' || status !== 'all';

  return (
    <>
      <div className="filter-bar">
        <input
          className="search-input"
          type="search"
          placeholder="搜索项目名称"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          aria-label="按项目名称搜索"
        />
        <div className="status-filter" role="group" aria-label="按状态筛选">
          {(Object.keys(PROJECT_FILTER_LABELS) as ProjectStatusFilter[]).map((option) => (
            <button
              className={status === option ? 'segment-button active' : 'segment-button'}
              key={option}
              type="button"
              onClick={() => onStatusChange(option)}
            >
              {PROJECT_FILTER_LABELS[option]}
            </button>
          ))}
        </div>
        <button className="text-button" type="button" onClick={onClearFilters} disabled={!hasActiveFilter}>
          清空筛选
        </button>
      </div>

      {loadState === 'loading' && <div className="loading-line">项目加载中…</div>}

      {loadState === 'error' && (
        <div className="error-panel">
          <strong>项目列表加载失败</strong>
          <p>无法读取本地数据库，请稍后重试。</p>
          <button className="secondary-button" type="button" onClick={onRetry}>重新加载</button>
        </div>
      )}

      {loadState === 'ready' && projects.length === 0 && !hasActiveFilter && (
        <div className="empty-state">
          <div className="empty-icon">＋</div>
          <strong>还没有毕业项目</strong>
          <p>导入模板后，创建你的第一个项目。</p>
          <div className="empty-actions">
            <button className="secondary-button" type="button" onClick={onImportTemplate}>
              导入代码模板
            </button>
            <button className="secondary-button ghost" type="button" onClick={onCreateProject}>
              新建项目
            </button>
          </div>
        </div>
      )}

      {loadState === 'ready' && projects.length === 0 && hasActiveFilter && (
        <div className="empty-state">
          <div className="empty-icon">∅</div>
          <strong>没有找到匹配的项目</strong>
          <p>试试更换关键词或清除筛选条件。</p>
          <button className="secondary-button" type="button" onClick={onClearFilters}>清空筛选</button>
        </div>
      )}

      {loadState === 'ready' && projects.length > 0 && (
        <>
          <div className="list-summary">共 {projects.length} 个项目</div>
          <ul className="project-table">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                busy={busyProjectId === project.id}
                onStatusChange={onStatusChangeForProject}
                onRename={onRenameProject}
                onArchive={onArchiveProject}
                onOpenPath={onOpenPath}
                onDevelop={onDevelop}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
