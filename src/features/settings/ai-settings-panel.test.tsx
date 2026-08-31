// 中文注释：AI 设置面板渲染测试。覆盖默认字段值、未配置 Key 时测试按钮禁用、
// 保存成功清空 Key 输入框、连接成功/失败反馈。desktopApi 使用测试 mock。
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { installDesktopApiMock } from '../../test/desktop-api-mock';
import type { AiConfigDto, AiConnectionResult, AiSaveConfigInput } from './settings-types';
import { AiSettingsPanel } from './ai-settings-panel';

const DEFAULT_DTO = { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com' } as const;

function apiKeyInput(): HTMLInputElement {
  return screen.getByLabelText(/API Key/) as HTMLInputElement;
}

function testButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /测试连接/ }) as HTMLButtonElement;
}

describe('AI 设置面板', () => {
  it('加载后显示 Provider、模型与 API 地址默认值', async () => {
    installDesktopApiMock();
    render(<AiSettingsPanel />);
    expect(await screen.findByDisplayValue('deepseek-chat')).toBeTruthy();
    expect(screen.getByDisplayValue('https://api.deepseek.com')).toBeTruthy();
    expect(screen.getByDisplayValue('DeepSeek')).toBeTruthy();
  });

  it('未配置 API Key 时测试连接按钮禁用', async () => {
    installDesktopApiMock({
      getAiConfig: vi.fn(async () => ({ ...DEFAULT_DTO, hasApiKey: false })),
    });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');
    expect(testButton().disabled).toBe(true);
  });

  it('已配置 API Key 时测试连接按钮可用', async () => {
    installDesktopApiMock({
      getAiConfig: vi.fn(async () => ({ ...DEFAULT_DTO, hasApiKey: true })),
    });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');
    expect(testButton().disabled).toBe(false);
  });

  it('保存成功后清空 API Key 输入框并提示成功', async () => {
    const saveAiConfig = vi.fn(async (_input: AiSaveConfigInput): Promise<AiConfigDto> => ({ ...DEFAULT_DTO, hasApiKey: true }));
    installDesktopApiMock({ saveAiConfig });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');

    fireEvent.change(screen.getByLabelText(/模型/), { target: { value: 'deepseek-reasoner' } });
    fireEvent.change(apiKeyInput(), { target: { value: 'sk-new-key' } });
    fireEvent.click(screen.getByRole('button', { name: /保存配置/ }));

    await waitFor(() => {
      expect(saveAiConfig).toHaveBeenCalledWith({
        provider: 'deepseek',
        model: 'deepseek-reasoner',
        apiBaseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-new-key',
      });
    });
    expect(apiKeyInput().value).toBe('');
    expect(await screen.findByText('配置已保存')).toBeTruthy();
  });

  it('保存失败显示错误信息且不清空输入', async () => {
    const saveAiConfig = vi.fn(async () => {
      throw new Error('模型不能为空');
    });
    installDesktopApiMock({ saveAiConfig });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');

    fireEvent.change(apiKeyInput(), { target: { value: 'sk-new-key' } });
    fireEvent.click(screen.getByRole('button', { name: /保存配置/ }));

    expect(await screen.findByText('模型不能为空')).toBeTruthy();
    expect(apiKeyInput().value).toBe('sk-new-key');
  });

  it('测试连接成功显示成功状态与耗时', async () => {
    const testAiConnection = vi.fn(async (): Promise<AiConnectionResult> => ({ ok: true, provider: 'deepseek', model: 'deepseek-chat', elapsedMs: 320 }));
    installDesktopApiMock({
      getAiConfig: vi.fn(async () => ({ ...DEFAULT_DTO, hasApiKey: true })),
      testAiConnection,
    });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');

    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    expect(await screen.findByText(/连接成功/)).toBeTruthy();
    expect(screen.getByText(/320/)).toBeTruthy();
  });

  it('测试连接失败显示分类错误码与信息', async () => {
    const testAiConnection = vi.fn(async (): Promise<AiConnectionResult> => ({ ok: false, code: 'AI_TIMEOUT', message: '连接 DeepSeek 超时' }));
    installDesktopApiMock({
      getAiConfig: vi.fn(async () => ({ ...DEFAULT_DTO, hasApiKey: true })),
      testAiConnection,
    });
    render(<AiSettingsPanel />);
    await screen.findByDisplayValue('deepseek-chat');

    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    expect(await screen.findByText(/\[AI_TIMEOUT\]/)).toBeTruthy();
    expect(screen.getByText(/连接 DeepSeek 超时/)).toBeTruthy();
  });
});
