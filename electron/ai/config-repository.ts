// 中文注释：AI 配置仓储。配置以独立 JSON 文件存放在 Electron userData 目录，
// 与项目数据库分离，生命周期独立。本模块只负责文件读写与字段规范化，
// 不依赖 BrowserWindow，也不发起网络请求。

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_AI_CONFIG, type StoredAiConfig } from './ai-types.js';

export const AI_CONFIG_FILE_NAME = 'ai-config.json';

export function getAiConfigFilePath(userDataPath: string): string {
  return join(userDataPath, AI_CONFIG_FILE_NAME);
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// 中文注释：读取配置。文件不存在、JSON 损坏或字段不合法时逐字段回退默认值，
// 并把 API Key 视为空；任何读取失败都不允许阻止应用启动。
export async function readAiConfig(userDataPath: string): Promise<StoredAiConfig> {
  try {
    const raw = await readFile(getAiConfigFilePath(userDataPath), 'utf8');
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AI_CONFIG };
  }
}

export function normalizeStoredConfig(raw: unknown): StoredAiConfig {
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_AI_CONFIG };
  }
  const record = raw as Record<string, unknown>;
  return {
    provider: record.provider === 'deepseek' ? 'deepseek' : DEFAULT_AI_CONFIG.provider,
    model:
      typeof record.model === 'string' && record.model.trim() !== ''
        ? record.model.trim()
        : DEFAULT_AI_CONFIG.model,
    apiBaseUrl: isHttpUrl(record.apiBaseUrl) ? (record.apiBaseUrl as string).trim() : DEFAULT_AI_CONFIG.apiBaseUrl,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : DEFAULT_AI_CONFIG.apiKey,
  };
}

// 中文注释：先写临时文件再原子替换，保证写入失败时旧文件仍可读；
// 配置文件包含 API Key，权限收窄为当前用户可读写。
export async function writeAiConfig(userDataPath: string, config: StoredAiConfig): Promise<void> {
  const filePath = getAiConfigFilePath(userDataPath);
  const tempPath = `${filePath}.tmp`;
  await mkdir(userDataPath, { recursive: true });
  await writeFile(tempPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tempPath, filePath);
}
