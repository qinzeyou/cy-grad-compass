// 中文注释：AI 设置 IPC 测试。用假注册器捕获通道与处理器，验证保存入参
// 校验、空 Key 保留旧值、get 不泄露 Key、test 使用已保存配置发起请求。
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mock, test } from 'node:test';
import { writeAiConfig } from '../ai/config-repository.js';
import { getAiConfigFilePath } from '../ai/config-repository.js';
import { registerAiIpcHandlers, type AiIpcRegistrar } from '../ipc/ai-handlers.js';

type Handler = (...args: unknown[]) => Promise<unknown>;

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ai-handlers-test-'));
}

function registerWith(userDataPath: string): Map<string, Handler> {
  const registered = new Map<string, Handler>();
  const registrar: AiIpcRegistrar = { handle: (channel, listener) => registered.set(channel, listener as Handler) };
  registerAiIpcHandlers({ getUserDataPath: () => userDataPath }, registrar);
  return registered;
}

const SAVE_INPUT = { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com' };

test('注册 ai:get-config / ai:save-config / ai:test-connection 三个通道', async () => {
  const registered = registerWith(await makeTempDir());
  assert.deepEqual([...registered.keys()].sort(), ['ai:get-config', 'ai:save-config', 'ai:test-connection']);
});

test('get 返回 DTO 且不泄露 API Key', async () => {
  const dir = await makeTempDir();
  await writeAiConfig(dir, { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-keep-secret' });
  const dto = (await registerWith(dir).get('ai:get-config')?.({})) as Record<string, unknown>;
  assert.equal(dto.hasApiKey, true);
  assert.equal('apiKey' in dto, false);
});

test('保存合法配置后写入文件并返回 DTO', async () => {
  const dir = await makeTempDir();
  const dto = (await registerWith(dir).get('ai:save-config')?.({}, { ...SAVE_INPUT, model: 'deepseek-reasoner', apiKey: 'sk-new-key' })) as Record<string, unknown>;
  assert.equal(dto.model, 'deepseek-reasoner');
  assert.equal(dto.hasApiKey, true);
  assert.equal('apiKey' in dto, false);
  const onDisk = JSON.parse(await readFile(getAiConfigFilePath(dir), 'utf8')) as { model: string; apiKey: string };
  assert.equal(onDisk.model, 'deepseek-reasoner');
  assert.equal(onDisk.apiKey, 'sk-new-key');
});

test('保存时空 Key 保留旧 Key', async () => {
  const dir = await makeTempDir();
  await writeAiConfig(dir, { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-old-key' });
  await registerWith(dir).get('ai:save-config')?.({}, { ...SAVE_INPUT, apiKey: '   ' });
  const onDisk = JSON.parse(await readFile(getAiConfigFilePath(dir), 'utf8')) as { apiKey: string };
  assert.equal(onDisk.apiKey, 'sk-old-key');
});

test('省略 apiKey 时也保留旧 Key', async () => {
  const dir = await makeTempDir();
  await writeAiConfig(dir, { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-old-key' });
  await registerWith(dir).get('ai:save-config')?.({}, SAVE_INPUT);
  const onDisk = JSON.parse(await readFile(getAiConfigFilePath(dir), 'utf8')) as { apiKey: string };
  assert.equal(onDisk.apiKey, 'sk-old-key');
});

test('非法 Provider、空模型、超长模型被拒绝', async () => {
  const save = registerWith(await makeTempDir()).get('ai:save-config') as Handler;
  await assert.rejects(() => save({}, { ...SAVE_INPUT, provider: 'openai' }), /DeepSeek/);
  await assert.rejects(() => save({}, { ...SAVE_INPUT, model: '   ' }), /模型不能为空/);
  await assert.rejects(() => save({}, { ...SAVE_INPUT, model: 'x'.repeat(101) }), /100/);
});

test('非法地址与超长 API Key 被拒绝', async () => {
  const save = registerWith(await makeTempDir()).get('ai:save-config') as Handler;
  await assert.rejects(() => save({}, { ...SAVE_INPUT, apiBaseUrl: 'ftp://bad' }), /地址/);
  await assert.rejects(() => save({}, { ...SAVE_INPUT, apiBaseUrl: 'not-a-url' }), /地址/);
  await assert.rejects(() => save({}, { ...SAVE_INPUT, apiKey: 'k'.repeat(501) }), /500/);
  await assert.rejects(() => save(undefined), /配置内容/);
});

test('test 使用已保存配置发起请求', async () => {
  const dir = await makeTempDir();
  await writeAiConfig(dir, { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', apiKey: 'sk-from-file' });
  let authHeader = '';
  mock.method(globalThis, 'fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    authHeader = new Headers(init?.headers).get('Authorization') ?? '';
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
  });
  try {
    const result = (await registerWith(dir).get('ai:test-connection')?.({})) as { ok: boolean };
    assert.equal(result.ok, true);
    assert.equal(authHeader, 'Bearer sk-from-file');
  } finally {
    mock.restoreAll();
  }
});
