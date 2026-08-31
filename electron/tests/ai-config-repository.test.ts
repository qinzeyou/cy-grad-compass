// 中文注释：AI 配置仓储测试。覆盖文件不存在、JSON 损坏、字段不合法、
// 写入后读出一致、目录自动创建，以及 DTO 只返回 hasApiKey 不泄露 Key。
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_AI_CONFIG, toAiConfigDto } from '../ai/ai-types.js';
import { getAiConfigFilePath, readAiConfig, writeAiConfig } from '../ai/config-repository.js';

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ai-config-repository-test-'));
}

test('配置文件不存在时返回默认配置', async () => {
  const config = await readAiConfig(await makeTempDir());
  assert.equal(config.provider, 'deepseek');
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(config.apiBaseUrl, 'https://api.deepseek.com');
  assert.equal(config.apiKey, '');
});

test('损坏 JSON 回退到默认配置', async () => {
  const dir = await makeTempDir();
  await writeFile(getAiConfigFilePath(dir), '{ 不是合法 JSON', 'utf8');
  assert.deepEqual(await readAiConfig(dir), DEFAULT_AI_CONFIG);
});

test('字段不合法时逐字段回退默认值', async () => {
  const dir = await makeTempDir();
  await writeFile(
    getAiConfigFilePath(dir),
    JSON.stringify({ provider: 'openai', model: '   ', apiBaseUrl: 'ftp://bad', apiKey: 123 }),
    'utf8',
  );
  const config = await readAiConfig(dir);
  assert.equal(config.provider, 'deepseek');
  assert.equal(config.model, 'deepseek-chat');
  assert.equal(config.apiBaseUrl, 'https://api.deepseek.com');
  assert.equal(config.apiKey, '');
});

test('写入后读取结果一致', async () => {
  const dir = await makeTempDir();
  const stored = { provider: 'deepseek' as const, model: 'deepseek-reasoner', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-test-123' };
  await writeAiConfig(dir, stored);
  assert.deepEqual(await readAiConfig(dir), stored);
  const onDisk = JSON.parse(await readFile(getAiConfigFilePath(dir), 'utf8')) as typeof stored;
  assert.deepEqual(onDisk, stored);
});

test('目标目录不存在时写入自动创建', async () => {
  const dir = join(await makeTempDir(), 'nested', 'user-data');
  await writeAiConfig(dir, DEFAULT_AI_CONFIG);
  assert.equal((await readAiConfig(dir)).model, 'deepseek-chat');
});

test('DTO 只返回 hasApiKey 且不泄露 API Key', () => {
  const dto = toAiConfigDto({ provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-secret' });
  assert.equal(dto.hasApiKey, true);
  assert.equal('apiKey' in dto, false);
  assert.deepEqual(dto, { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', hasApiKey: true });
});

test('空 API Key 的 DTO hasApiKey 为 false', () => {
  assert.equal(toAiConfigDto({ ...DEFAULT_AI_CONFIG, apiKey: '   ' }).hasApiKey, false);
});
