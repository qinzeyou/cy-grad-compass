// 中文注释：AI 服务配置的类型定义、默认值与 DTO 映射。
// API Key 只存在于主进程的 StoredAiConfig 中，跨 IPC 返回的
// AiConfigDto 只携带 hasApiKey 布尔值，避免把密钥回传渲染进程。

export type AiProviderName = 'deepseek';

export interface StoredAiConfig {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  apiKey: string;
}

export interface AiConfigDto {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  hasApiKey: boolean;
}

export type AiConnectionErrorCode = 'AI_CONFIG' | 'AI_TIMEOUT' | 'AI_HTTP' | 'AI_RESPONSE' | 'AI_NETWORK';

export type AiConnectionResult =
  | { ok: true; provider: AiProviderName; model: string; elapsedMs: number }
  | { ok: false; code: AiConnectionErrorCode; message: string };

// 中文注释：保存配置的入参。apiKey 省略或为空时表示保留旧 Key，
// 只有显式传入非空 Key 才替换。
export interface AiSaveConfigInput {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  apiKey?: string;
}

export const DEFAULT_AI_CONFIG: StoredAiConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiBaseUrl: 'https://api.deepseek.com',
  apiKey: '',
};

export function toAiConfigDto(config: StoredAiConfig): AiConfigDto {
  return {
    provider: config.provider,
    model: config.model,
    apiBaseUrl: config.apiBaseUrl,
    hasApiKey: config.apiKey.trim() !== '',
  };
}
