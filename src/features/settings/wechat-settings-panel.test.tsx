import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WechatSettingsPanel } from './wechat-settings-panel';
import { installDesktopApiMock } from '../../test/desktop-api-mock';

describe('微信设置', () => {
  it('选择账号目录后回填输入框', async () => {
    installDesktopApiMock({ selectDirectory: async () => 'E:/wechat-account' });
    render(<WechatSettingsPanel />);
    await screen.findByText('微信数据源');
    const input = screen.getAllByRole('textbox')[0];
    fireEvent.click(screen.getAllByRole('button', { name: /选\s*择/ })[0]);
    await waitFor(() => expect(input).toHaveProperty('value', 'E:/wechat-account'));
  });

  it('选择项目根目录后回填输入框', async () => {
    installDesktopApiMock({ selectDirectory: async () => 'E:/projects' });
    render(<WechatSettingsPanel />);
    await screen.findByText('微信数据源');
    const input = screen.getAllByRole('textbox')[1];
    fireEvent.click(screen.getAllByRole('button', { name: /选\s*择/ })[1]);
    await waitFor(() => expect(input).toHaveProperty('value', 'E:/projects'));
  });

  it('不再读取 WeFlow 配置', async () => {
    const api = installDesktopApiMock();
    render(<WechatSettingsPanel />);
    await screen.findByText('微信数据源');
    expect(api.getWeFlowConfig).not.toHaveBeenCalled();
  });
});
