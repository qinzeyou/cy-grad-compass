import { useEffect, useState, type ReactElement } from 'react';
import { ProjectManagementPage } from './features/project-management/project-management-page';
import { TemplatePanel } from './features/project-management/template-panel';
import { ProjectStatisticsPage } from './features/project-statistics/project-statistics-page';
import type { EmptyAction } from './features/project-statistics/recent-project-list';
import type { ProjectStatusFilter } from './features/project-statistics/project-statistics-types';

type NavKey = 'dashboard' | 'projects' | 'templates';

const NAV_ITEMS: Array<{ key: NavKey; label: string }> = [
  { key: 'dashboard', label: '仪表盘' },
  { key: 'projects', label: '项目管理' },
  { key: 'templates', label: '模板管理' },
];

const PAGE_TITLES: Record<NavKey, string> = {
  dashboard: '仪表盘',
  projects: '项目管理',
  templates: '模板管理',
};

// 中文注释：应用外壳，负责主导航切换、统计卡片跳转筛选和空状态入口的真实跳转。
export function App(): ReactElement {
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [projectsStatus, setProjectsStatus] = useState<ProjectStatusFilter>('all');
  const [appVersion, setAppVersion] = useState('读取中');

  useEffect(() => {
    void window.desktopApi.getAppVersion().then(setAppVersion);
  }, []);

  // 中文注释：统计卡片点击后跳转到项目管理页，并自动带入对应状态筛选。
  const navigateToProjects = (status: ProjectStatusFilter) => {
    setProjectsStatus(status);
    setActiveNav('projects');
  };

  // 中文注释：空状态入口现在是真实操作：导入模板跳转模板管理页，新建项目跳转项目管理页。
  const handleEmptyAction = (action: EmptyAction) => {
    setActiveNav(action === 'import-template' ? 'templates' : 'projects');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">CY</div>
        <div className="brand-copy">
          <strong>毕业设计指南针</strong>
          <span>项目工作台</span>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              className={activeNav === item.key ? 'nav-item active' : 'nav-item'}
              key={item.key}
              onClick={() => setActiveNav(item.key)}
              type="button"
            >
              <span className="nav-dot" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>桌面版</span>
          <small>v{appVersion}</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / 2026</span>
            <h1>{PAGE_TITLES[activeNav]}</h1>
          </div>
          <button className="primary-button" type="button" onClick={() => setActiveNav('projects')}>
            ＋ 新建项目
          </button>
        </header>

        {activeNav === 'dashboard' && (
          <ProjectStatisticsPage onNavigateToProjects={navigateToProjects} onEmptyAction={handleEmptyAction} />
        )}

        {activeNav === 'projects' && (
          <ProjectManagementPage
            key={projectsStatus}
            initialStatus={projectsStatus}
            onImportTemplate={() => setActiveNav('templates')}
          />
        )}

        {activeNav === 'templates' && <TemplatePanel />}
      </main>
    </div>
  );
}
