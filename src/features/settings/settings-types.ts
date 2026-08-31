// 中文注释：渲染进程侧的 AI 设置类型，与主进程 ai-types.ts 的 DTO 结构保持一致，
// 页面只依赖这里的类型；apiKey 永远不会出现在渲染进程返回值中。

export type AiProviderName = 'deepseek';

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

// 中文注释：保存入参。apiKey 省略或为空时主进程保留旧 Key。
export interface AiSaveConfigInput {
  provider: AiProviderName;
  model: string;
  apiBaseUrl: string;
  apiKey?: string;
}
