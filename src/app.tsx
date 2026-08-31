import { useEffect, useState, type ReactElement } from 'react';
import { App as AntApp, Button, ConfigProvider, Layout, Menu, Space, Tooltip, Typography } from 'antd';
import { AppstoreOutlined, BarChartOutlined, CodeOutlined, CloseOutlined, MinusOutlined, ProjectOutlined, ArrowsAltOutlined } from '@ant-design/icons';
import { ProjectManagementPage } from './features/project-management/project-management-page';
import { ProjectStatisticsPage } from './features/project-statistics/project-statistics-page';
import { ProjectDevelopmentPage } from './features/project-development/project-development-page';
import type { EmptyAction } from './features/project-statistics/recent-project-list';
import type { ProjectStatusFilter } from './features/project-statistics/project-statistics-types';

type NavKey = 'dashboard' | 'projects' | 'development';
const NAV_ITEMS = [{ key: 'dashboard', icon: <BarChartOutlined />, label: '仪表盘' }, { key: 'projects', icon: <ProjectOutlined />, label: '项目管理' }, { key: 'development', icon: <CodeOutlined />, label: '项目开发' }];

// 中文注释：应用外壳统一承载窗口栏、侧边导航和内容滚动，页面组件只处理业务内容。
export function App(): ReactElement {
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard'); const [status, setStatus] = useState<ProjectStatusFilter>('all'); const [version, setVersion] = useState('读取中'); const [maximized, setMaximized] = useState(false);
  useEffect(() => { void window.desktopApi.getAppVersion().then(setVersion); void window.desktopApi.isMaximized().then(setMaximized); }, []);
  const handleEmptyAction = (_action: EmptyAction) => setActiveNav('projects');
  return <ConfigProvider theme={{ token: { colorPrimary: '#2F6BFF', colorBgLayout: '#F5F7FA', borderRadius: 8, fontFamily: "'Microsoft YaHei', sans-serif" } }}><AntApp><Layout className="app-frame">
    <header className="window-bar"><div className="window-brand"><span className="window-logo">CY</span><div><Typography.Text strong>毕业设计指南针</Typography.Text><Typography.Text type="secondary">项目工作台</Typography.Text></div></div><Space className="window-controls" size={0}><Tooltip title="最小化"><Button type="text" icon={<MinusOutlined />} onClick={() => void window.desktopApi.minimizeWindow()} /></Tooltip><Tooltip title={maximized ? '还原' : '最大化'}><Button type="text" icon={<ArrowsAltOutlined />} onClick={() => void window.desktopApi.toggleMaximizeWindow().then(setMaximized)} /></Tooltip><Tooltip title="关闭"><Button type="text" danger icon={<CloseOutlined />} onClick={() => void window.desktopApi.closeWindow()} /></Tooltip></Space></header>
    <Layout><Layout.Sider className="app-sidebar" width={232} theme="light"><div className="sidebar-inner"><div className="sidebar-caption">WORKSPACE / 2026</div><Menu theme="light" mode="inline" selectedKeys={[activeNav]} items={NAV_ITEMS} onClick={({ key }) => setActiveNav(key as NavKey)} /><div className="sidebar-footer"><span>桌面版</span><small>v{version}</small></div></div></Layout.Sider><Layout className="main-layout"><div className="page-heading"><div><Typography.Text className="eyebrow">毕业设计项目工作台</Typography.Text><Typography.Title level={1}>{NAV_ITEMS.find((item) => item.key === activeNav)?.label}</Typography.Title></div><Button type="primary" icon={<AppstoreOutlined />} onClick={() => setActiveNav('projects')}>新建项目</Button></div><Layout.Content className="app-content">{activeNav === 'dashboard' && <ProjectStatisticsPage onNavigateToProjects={(next = 'all') => { setStatus(next); setActiveNav('projects'); }} onEmptyAction={handleEmptyAction} />}{activeNav === 'projects' && <ProjectManagementPage initialStatus={status} onImportTemplate={() => setActiveNav('projects')} onDevelop={() => setActiveNav('development')} />}{activeNav === 'development' && <ProjectDevelopmentPage />}</Layout.Content></Layout></Layout>
  </Layout></AntApp></ConfigProvider>;
}
