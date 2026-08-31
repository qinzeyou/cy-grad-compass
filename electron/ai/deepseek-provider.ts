// 中文注释：DeepSeek 连通性测试服务。只接收完整配置并发起最小非流式请求，
// 不负责配置文件读写；错误统一归类为 AI_CONFIG / AI_TIMEOUT / AI_HTTP /
// AI_RESPONSE / AI_NETWORK，错误文本截断并替换完整 API Key。

import type { AiConnectionResult, StoredAiConfig } from './ai-types.js';

export const DEEPSEEK_REQUEST_TIMEOUT_MS = 60_000;
const MAX_ERROR_TEXT_LENGTH = 240;

export interface DeepSeekConnectionOptions {
  timeoutMs?: number;
}

interface DeepSeekHttpError extends Error {
  status: number;
  bodyText: string;
}

function httpError(status: number, bodyText: string): DeepSeekHttpError {
  const error = new Error(`DeepSeek HTTP ${status}`) as DeepSeekHttpError;
  error.status = status;
  error.bodyText = bodyText;
  return error;
}

function isHttpError(error: unknown): error is DeepSeekHttpError {
  return error instanceof Error && typeof (error as DeepSeekHttpError).status === 'number';
}

// 中文注释：替换完整 API Key 并按固定长度截断，任何错误文本都不能回传密钥。
function sanitizeText(text: string, apiKey: string): string {
  const safe = apiKey === '' ? text : text.split(apiKey).join('***');
  return safe.length > MAX_ERROR_TEXT_LENGTH ? `${safe.slice(0, MAX_ERROR_TEXT_LENGTH)}…` : safe;
}

function classifyError(error: unknown, apiKey: string): AiConnectionResult {
  if (error instanceof Error && error.name === 'AbortError') {
    return { ok: false, code: 'AI_TIMEOUT', message: '连接 DeepSeek 超时，请检查网络、API 地址或服务状态' };
  }
  if (isHttpError(error)) {
    const hint = error.status === 401 || error.status === 403 ? '（API Key 可能无效）' : '';
    return {
      ok: false,
      code: 'AI_HTTP',
      message: sanitizeText(`DeepSeek 返回 HTTP ${error.status}${hint}：${error.bodyText}`, apiKey),
    };
  }
  if (error instanceof TypeError) {
    return { ok: false, code: 'AI_NETWORK', message: '无法连接 DeepSeek 服务，请检查网络连接' };
  }
  return {
    ok: false,
    code: 'AI_NETWORK',
    message: error instanceof Error ? sanitizeText(error.message, apiKey) : '无法连接 DeepSeek 服务，请稍后重试',
  };
}

/**
 * 测试与 DeepSeek 的连通性：向 `${apiBaseUrl}/chat/completions` 发起最小非流式请求。
 * 失败时返回分类错误码，绝不抛出异常，也绝不回传 API Key。
 */
export async function testDeepSeekConnection(
  config: StoredAiConfig,
  options: DeepSeekConnectionOptions = {},
): Promise<AiConnectionResult> {
  const startedAt = Date.now();
  const apiKey = config.apiKey.trim();
  if (apiKey === '') {
    return { ok: false, code: 'AI_CONFIG', message: '尚未配置 API Key' };
  }

  const baseUrl = config.apiBaseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEEPSEEK_REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '你好' }],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        // 中文注释：正文读取失败时只保留状态码，不影响错误分类。
      }
      throw httpError(response.status, bodyText);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { ok: false, code: 'AI_RESPONSE', message: '服务响应不是合法 JSON，请检查 API 地址与模型配置' };
    }

    const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      return { ok: false, code: 'AI_RESPONSE', message: '服务响应缺少 choices[0].message.content，响应格式异常' };
    }

    return { ok: true, provider: config.provider, model: config.model, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return classifyError(error, apiKey);
  } finally {
    clearTimeout(timer);
  }
}
