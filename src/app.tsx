import { useEffect, useState, type ReactElement } from 'react';
import { App as AntApp, Button, ConfigProvider, Layout, Menu, Space, Tooltip, Typography } from 'antd';
import { BarChartOutlined, CodeOutlined, CloseOutlined, MinusOutlined, ProjectOutlined, ArrowsAltOutlined, SettingOutlined } from '@ant-design/icons';
import { ProjectManagementPage } from './features/project-management/project-management-page';
import { ProjectStatisticsPage } from './features/project-statistics/project-statistics-page';
import { ProjectDevelopmentPage } from './features/project-development/project-development-page';
import logoUrl from '../assets/logo.png';
import { SettingsPage } from './features/settings/settings-page';
import type { ProjectStatusFilter } from './features/project-statistics/project-statistics-types';

type NavKey = 'dashboard' | 'projects' | 'development' | 'settings';
const NAV_ITEMS = [{ key: 'dashboard', icon: <BarChartOutlined />, label: '仪表盘' }, { key: 'projects', icon: <ProjectOutlined />, label: '项目管理' }, { key: 'development', icon: <CodeOutlined />, label: '项目开发' }, { key: 'settings', icon: <SettingOutlined />, label: '设置' }];

// 中文注释：应用外壳统一承载窗口栏、侧边导航和内容滚动，页面组件只处理业务内容。
export function App(): ReactElement {
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard'); const [status, setStatus] = useState<ProjectStatusFilter>('all'); const [maximized, setMaximized] = useState(false);
  useEffect(() => { void window.desktopApi.isMaximized().then(setMaximized); }, []);
  return <ConfigProvider theme={{ token: { colorPrimary: '#2F6BFF', colorBgLayout: '#F5F7FA', borderRadius: 8, fontFamily: "'Microsoft YaHei', sans-serif" } }}><AntApp><Layout className="app-frame">
    <header className="window-bar"><div className="window-bar-brand"><img className="window-logo" src={logoUrl} alt="毕业设计指南针 Logo" /><Typography.Text strong>毕业设计指南针</Typography.Text></div><div className="window-bar-main"><div className="window-bar-drag-space" aria-hidden="true" /><Space className="window-controls" size={0}><Tooltip title="最小化"><Button type="text" icon={<MinusOutlined />} onClick={() => void window.desktopApi.minimizeWindow()} /></Tooltip><Tooltip title={maximized ? '还原' : '最大化'}><Button type="text" icon={<ArrowsAltOutlined />} onClick={() => void window.desktopApi.toggleMaximizeWindow().then(setMaximized)} /></Tooltip><Tooltip title="关闭"><Button type="text" danger icon={<CloseOutlined />} onClick={() => void window.desktopApi.closeWindow()} /></Tooltip></Space></div></header>
    <Layout><Layout.Sider className="app-sidebar" width={232} theme="light"><div className="sidebar-inner"><Menu theme="light" mode="inline" selectedKeys={[activeNav]} items={NAV_ITEMS} onClick={({ key }) => setActiveNav(key as NavKey)} /></div></Layout.Sider><Layout className="main-layout"><Layout.Content className={activeNav === 'development' ? 'app-content development-content' : 'app-content'}>{activeNav === 'dashboard' && <ProjectStatisticsPage />}{activeNav === 'projects' && <ProjectManagementPage initialStatus={status} onDevelop={() => setActiveNav('development')} />}{activeNav === 'development' && <ProjectDevelopmentPage />}{activeNav === 'settings' && <SettingsPage />}</Layout.Content></Layout></Layout>
  </Layout></AntApp></ConfigProvider>;
}
