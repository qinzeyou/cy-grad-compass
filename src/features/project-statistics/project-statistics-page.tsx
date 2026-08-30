import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { fetchProjectStatistics } from './project-statistics-api';
import { ProjectStatisticsCard } from './project-statistics-card';
import type { EmptyAction } from './recent-project-list';
import { RecentProjectList } from './recent-project-list';
import type { ProjectStatistics, ProjectStatusFilter, RecentProject } from './project-statistics-types';

interface ProjectStatisticsPageProps {
  onNavigateToProjects: (status: ProjectStatusFilter) => void;
  onEmptyAction: (action: EmptyAction) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

// 中文注释：仪表盘统计页。每次进入页面都重新查询统计，保证状态变化后展示的是最新数据。
export function ProjectStatisticsPage({ onNavigateToProjects, onEmptyAction }: ProjectStatisticsPageProps): ReactElement {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [statistics, setStatistics] = useState<ProjectStatistics | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatistics = useCallback(() => {
    setLoadState('loading');
    fetchProjectStatistics()
      .then((data) => {
        setStatistics(data);
        setLoadState('ready');
      })
      .catch(() => {
        setLoadState('error');
      });
  }, []);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // 中文注释：打开最近项目的目录；shell.openPath 返回空字符串表示成功，非空为系统错误文本。
  const handleOpenPath = useCallback(async (project: RecentProject) => {
    const result = await window.desktopApi.openPath(project.path);
    setNotice(result === '' ? null : `无法打开项目目录：${result}`);
  }, []);

  const cards: Array<{ label: string; value: number | string; tone: 'dark' | 'yellow' | 'green' | 'light'; status: ProjectStatusFilter }> = [
    { label: '项目总数', value: loadState === 'loading' ? '—' : (statistics?.total ?? 0), tone: 'dark', status: 'all' },
    { label: '进行中', value: loadState === 'loading' ? '—' : (statistics?.inProgress ?? 0), tone: 'yellow', status: 'in-progress' },
    { label: '已完成', value: loadState === 'loading' ? '—' : (statistics?.completed ?? 0), tone: 'green', status: 'completed' },
    { label: '已归档', value: loadState === 'loading' ? '—' : (statistics?.archived ?? 0), tone: 'light', status: 'archived' },
  ];

  return (
    <>
      <section className="welcome-strip">
        <div>
          <span className="eyebrow">PROJECT CONTROL CENTER</span>
          <h2>把每一个毕业项目，推进到可交付。</h2>
          <p>从模板生成项目，集中管理目录与状态，随时掌握整体进度。</p>
        </div>
        <div className="welcome-badge">01<span>/</span>01</div>
      </section>

      {notice !== null && (
        <div className="notice-banner" role="alert">
          <span>{notice}</span>
          <button className="notice-close" type="button" onClick={() => setNotice(null)} aria-label="关闭提示">×</button>
        </div>
      )}

      {loadState === 'error' ? (
        <section className="error-panel">
          <strong>统计加载失败</strong>
          <p>无法读取本地数据库，请稍后重试。</p>
          <button className="secondary-button" type="button" onClick={loadStatistics}>重新加载</button>
        </section>
      ) : (
        <>
          <section className="metrics-grid" aria-label="项目统计">
            {cards.map((card) => (
              <ProjectStatisticsCard
                key={card.label}
                label={card.label}
                value={card.value}
                tone={card.tone}
                onClick={loadState === 'loading' ? undefined : () => onNavigateToProjects(card.status)}
              />
            ))}
          </section>

          {loadState === 'ready' && statistics !== null && (
            <section className="content-grid">
              <div className="panel project-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">RECENT PROJECTS</span>
                    <h3>最近项目</h3>
                  </div>
                  <button className="text-button" type="button" onClick={() => onNavigateToProjects('all')}>
                    查看全部 →
                  </button>
                </div>
                <RecentProjectList projects={statistics.recentProjects} onEmptyAction={onEmptyAction} onOpenPath={handleOpenPath} />
              </div>
              <div className="panel quick-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">QUICK START</span>
                    <h3>快速开始</h3>
                  </div>
                </div>
                <ol className="steps-list">
                  <li><span>01</span><div><strong>导入代码模板</strong><small>复制到应用模板库</small></div></li>
                  <li><span>02</span><div><strong>生成毕业项目</strong><small>选择目标目录并登记</small></div></li>
                  <li><span>03</span><div><strong>管理项目状态</strong><small>保持项目进度清晰</small></div></li>
                </ol>
              </div>
            </section>
          )}

          {loadState === 'loading' && (
            <div className="loading-line">统计加载中…</div>
          )}
        </>
      )}
    </>
  );
}
