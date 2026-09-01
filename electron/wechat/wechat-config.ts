import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WechatConfig, WechatConfigDto } from './wechat-types.js';

export const DEFAULT_WECHAT_CONFIG: WechatConfig = {
  accountDir: '',
  decryptKey: '',
  enabled: false,
  remarkPrefixes: ['鱼', '书'],
  selectedSessionIds: [],
  projectsRoot: 'E:\\副业\\开发',
  folderTemplate: '{MM-DD}_{projectName}',
};

export function getWechatConfigPath(userDataPath: string): string {
  return join(userDataPath, 'wechat-config.json');
}

export function normalizeWechatConfig(raw: unknown): WechatConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WECHAT_CONFIG };
  const value = raw as Record<string, unknown>;
  const prefixes = Array.isArray(value.remarkPrefixes)
    ? value.remarkPrefixes.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
    : DEFAULT_WECHAT_CONFIG.remarkPrefixes;
  const selected = Array.isArray(value.selectedSessionIds)
    ? value.selectedSessionIds.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
  return {
    accountDir: typeof value.accountDir === 'string' ? value.accountDir.trim() : '',
    decryptKey: typeof value.decryptKey === 'string' ? value.decryptKey.trim() : '',
    enabled: value.enabled === true,
    remarkPrefixes: prefixes.length ? prefixes : DEFAULT_WECHAT_CONFIG.remarkPrefixes,
    selectedSessionIds: selected,
    projectsRoot: typeof value.projectsRoot === 'string' && value.projectsRoot.trim() ? value.projectsRoot.trim() : DEFAULT_WECHAT_CONFIG.projectsRoot,
    folderTemplate: typeof value.folderTemplate === 'string' && value.folderTemplate.trim() ? value.folderTemplate.trim() : DEFAULT_WECHAT_CONFIG.folderTemplate,
  };
}

export function canConnectWechat(config: WechatConfig): boolean {
  return Boolean(config.accountDir && config.decryptKey);
}

export async function readWechatConfig(userDataPath: string): Promise<WechatConfig> {
  try {
    return normalizeWechatConfig(JSON.parse(await readFile(getWechatConfigPath(userDataPath), 'utf8')));
  } catch {
    return { ...DEFAULT_WECHAT_CONFIG };
  }
}

export async function writeWechatConfig(userDataPath: string, config: WechatConfig): Promise<void> {
  await mkdir(userDataPath, { recursive: true });
  const path = getWechatConfigPath(userDataPath);
  const temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(temp, path);
}

export function toWechatConfigDto(config: WechatConfig): WechatConfigDto {
  const { decryptKey: _decryptKey, ...safe } = config;
  return { ...safe, hasDecryptKey: config.decryptKey.length > 0 };
}
