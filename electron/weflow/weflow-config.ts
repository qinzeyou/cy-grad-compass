import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WeFlowConfig } from './weflow-types.js';

export const DEFAULT_WEflow_CONFIG: WeFlowConfig = { sourcePath: '', executablePath: '', baseUrl: 'http://127.0.0.1:5031', apiToken: '', autoStart: false };

export function getWeFlowConfigPath(userDataPath: string): string { return join(userDataPath, 'weflow-config.json'); }

export function normalizeWeFlowConfig(raw: unknown): WeFlowConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WEflow_CONFIG };
  const value = raw as Record<string, unknown>;
  return {
    sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath.trim() : '',
    executablePath: typeof value.executablePath === 'string' ? value.executablePath.trim() : '',
    baseUrl: typeof value.baseUrl === 'string' && value.baseUrl.trim() ? value.baseUrl.trim().replace(/\/+$/, '') : DEFAULT_WEflow_CONFIG.baseUrl,
    apiToken: typeof value.apiToken === 'string' ? value.apiToken.trim() : '',
    autoStart: value.autoStart === true,
  };
}

export async function readWeFlowConfig(userDataPath: string): Promise<WeFlowConfig> {
  try { return normalizeWeFlowConfig(JSON.parse(await readFile(getWeFlowConfigPath(userDataPath), 'utf8'))); } catch { return { ...DEFAULT_WEflow_CONFIG }; }
}

export async function writeWeFlowConfig(userDataPath: string, config: WeFlowConfig): Promise<void> {
  await mkdir(userDataPath, { recursive: true });
  const path = getWeFlowConfigPath(userDataPath); const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 }); await rename(temp, path);
}

export function toWeFlowConfigDto(config: WeFlowConfig): Omit<WeFlowConfig, 'apiToken'> & { hasApiToken: boolean } {
  const { apiToken: _apiToken, ...safe } = config; return { ...safe, hasApiToken: Boolean(config.apiToken) };
}
