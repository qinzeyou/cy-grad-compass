// 中文注释：应用外壳渲染测试。验证侧边菜单出现“设置”项，点击后能切换到
// AI 设置页，且仪表盘等既有入口仍保留。
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { installDesktopApiMock } from './test/desktop-api-mock';

describe('应用外壳', () => {
  it('侧边菜单包含仪表盘、项目管理、项目开发与设置', async () => {
    installDesktopApiMock();
    render(<App />);
    const labels = (await screen.findAllByRole('menuitem')).map((item) => item.textContent?.trim());
    expect(labels).toContain('仪表盘');
    expect(labels).toContain('项目管理');
    expect(labels).toContain('项目开发');
    expect(labels).toContain('设置');
  });

  it('点击设置菜单可打开 AI 设置页', async () => {
    installDesktopApiMock();
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /设置/ }));
    expect(await screen.findByText('AI 服务')).toBeTruthy();
    expect(screen.getByRole('button', { name: /保存配置/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /测试连接/ })).toBeTruthy();
  });
});
