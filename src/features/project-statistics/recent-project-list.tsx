import type { ReactElement } from 'react';
import { Button, Empty, Tag, Typography } from 'antd';
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
      <Empty description="还没有毕业项目">
        <Typography.Text type="secondary">导入模板后，创建你的第一个项目。</Typography.Text>
        <div className="empty-actions">
          <Button onClick={() => onEmptyAction('import-template')}>导入代码模板</Button><Button type="primary" onClick={() => onEmptyAction('create-project')}>新建项目</Button>
        </div>
      </Empty>
    );
  }

  return (
    <ul className="recent-list">
      {projects.map((project) => (
        <li className="recent-row" key={project.id}>
          <div className="recent-main">
            <strong>{project.name}</strong>
            <Tag color="blue">{PROJECT_STATUS_LABELS[project.status]}</Tag>
          </div>
          <div className="recent-meta">
            <span className="recent-path" title={project.path}>{project.path}</span>
            <time dateTime={project.createdAt}>{formatDate(project.createdAt)}</time>
          </div>
          <Button type="link" onClick={() => onOpenPath(project)}>打开目录</Button>
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
