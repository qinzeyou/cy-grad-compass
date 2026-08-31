// 中文注释：调用 preload 白名单 AI 设置 API 的唯一模块，页面组件不直接
// 触碰 window.desktopApi 之外的任何能力。
import type { AiConfigDto, AiConnectionResult, AiSaveConfigInput } from './settings-types';

export function fetchAiConfig(): Promise<AiConfigDto> {
  return window.desktopApi.getAiConfig();
}

export function saveAiConfig(input: AiSaveConfigInput): Promise<AiConfigDto> {
  return window.desktopApi.saveAiConfig(input);
}

export function testAiConnection(): Promise<AiConnectionResult> {
  return window.desktopApi.testAiConnection();
}
