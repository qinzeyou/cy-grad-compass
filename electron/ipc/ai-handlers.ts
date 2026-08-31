// 中文注释：AI 设置 IPC 通道。主进程是唯一可信校验点，渲染进程传入的配置
// 在这里完成类型与业务校验后才写入文件；API Key 只进不出，任何返回都只带 hasApiKey。
import { ipcMain } from 'electron';
import {
  toAiConfigDto,
  type AiSaveConfigInput,
  type StoredAiConfig,
} from '../ai/ai-types.js';
import { readAiConfig, writeAiConfig } from '../ai/config-repository.js';
import { testDeepSeekConnection } from '../ai/deepseek-provider.js';

export interface AiIpcContext {
  getUserDataPath(): string;
}

export interface AiIpcRegistrar {
  handle(channel: string, listener: (...args: unknown[]) => unknown): void;
}

const MODEL_MAX_LENGTH = 100;
const API_KEY_MAX_LENGTH = 500;

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 中文注释：保存入参校验与规范化。apiKey 省略或去除首尾空格后为空时
// 返回 undefined，由调用方保留旧 Key；所有错误抛出中文提示。
export function normalizeAiSaveInput(input: unknown): AiSaveConfigInput {
  if (typeof input !== 'object' || input === null) {
    throw new Error('缺少 AI 配置内容');
  }
  const record = input as Record<string, unknown>;
  if (record.provider !== 'deepseek') {
    throw new Error('仅支持 DeepSeek Provider');
  }
  const model = typeof record.model === 'string' ? record.model.trim() : '';
  if (model === '') {
    throw new Error('模型不能为空');
  }
  if (model.length > MODEL_MAX_LENGTH) {
    throw new Error(`模型不能超过 ${MODEL_MAX_LENGTH} 个字符`);
  }
  const apiBaseUrl = typeof record.apiBaseUrl === 'string' ? record.apiBaseUrl.trim() : '';
  if (!isHttpUrl(apiBaseUrl)) {
    throw new Error('API 地址必须是合法的 http 或 https 地址');
  }
  let apiKey: string | undefined;
  if (record.apiKey !== undefined) {
    if (typeof record.apiKey !== 'string') {
      throw new Error('API Key 格式不正确');
    }
    const trimmed = record.apiKey.trim();
    if (trimmed !== '') {
      if (trimmed.length > API_KEY_MAX_LENGTH) {
        throw new Error(`API Key 不能超过 ${API_KEY_MAX_LENGTH} 个字符`);
      }
      apiKey = trimmed;
    }
  }
  return { provider: 'deepseek', model, apiBaseUrl, apiKey };
}

export function registerAiIpcHandlers(context: AiIpcContext, registrar: AiIpcRegistrar = ipcMain): void {
  registrar.handle('ai:get-config', async () => {
    const config = await readAiConfig(context.getUserDataPath());
    return toAiConfigDto(config);
  });

  registrar.handle('ai:save-config', async (_event, input: unknown) => {
    const validated = normalizeAiSaveInput(input);
    const existing = await readAiConfig(context.getUserDataPath());
    const next: StoredAiConfig = {
      provider: validated.provider,
      model: validated.model,
      apiBaseUrl: validated.apiBaseUrl,
      apiKey: validated.apiKey ?? existing.apiKey,
    };
    await writeAiConfig(context.getUserDataPath(), next);
    return toAiConfigDto(next);
  });

  registrar.handle('ai:test-connection', async () => {
    const config = await readAiConfig(context.getUserDataPath());
    return testDeepSeekConnection(config);
  });
}
