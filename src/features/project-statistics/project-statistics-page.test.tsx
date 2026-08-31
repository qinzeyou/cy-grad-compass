// 中文注释：仪表盘页面测试。页面只渲染空状态，不再查询统计、不再展示
// 统计卡片、最近项目或快速开始内容。
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { installDesktopApiMock } from '../../test/desktop-api-mock';
import { ProjectStatisticsPage } from './project-statistics-page';

describe('仪表盘页面', () => {
  it('渲染空状态文案', () => {
    installDesktopApiMock();
    render(<ProjectStatisticsPage />);
    expect(screen.getByText(/仪表盘内容已移除/)).toBeTruthy();
  });

  it('挂载时不再调用项目统计查询', () => {
    const api = installDesktopApiMock();
    render(<ProjectStatisticsPage />);
    expect(api.getProjectStatistics).not.toHaveBeenCalled();
  });

  it('不显示统计卡片、最近项目与快速开始内容', () => {
    installDesktopApiMock();
    render(<ProjectStatisticsPage />);
    expect(screen.queryByText('项目总数')).toBeNull();
    expect(screen.queryByText('进行中')).toBeNull();
    expect(screen.queryByText('最近项目')).toBeNull();
    expect(screen.queryByText('快速开始')).toBeNull();
  });
});
