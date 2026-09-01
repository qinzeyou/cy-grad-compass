import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WeFlowBridge } from '../weflow/weflow-bridge.js';
import type { WeFlowConfig } from '../weflow/weflow-types.js';

const config: WeFlowConfig = { sourcePath: '', executablePath: '', baseUrl: 'http://127.0.0.1:5031', apiToken: 'token', autoStart: false };

test('WeFlow 未运行且未开启自动启动时返回可读错误', async () => {
  const bridge = new WeFlowBridge({ fetch: async () => { throw new Error('offline'); }, spawn: () => ({ unref() {} }), wait: async () => undefined });
  await assert.rejects(() => bridge.listSessions(config), /WeFlow 未运行/);
});

test('WeFlow API 会话和消息映射为现有微信类型', async () => {
  const bridge = new WeFlowBridge({ fetch: async (input) => {
    if (input.endsWith('/health')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    if (input.includes('/contacts')) return new Response(JSON.stringify({ contacts: [{ username: 'wxid_a', displayName: '甲', remark: '鱼甲' }] }), { status: 200 });
    if (input.includes('/sessions?')) return new Response(JSON.stringify({ sessions: [{ id: 'wxid_a', name: '甲', type: 'private' }] }), { status: 200 });
    return new Response(JSON.stringify({ messages: [{ platformMessageId: 'm1', accountName: '甲', sender: 'wxid_a', type: 0, content: '已付款', timestamp: 10 }] }), { status: 200 });
  }, spawn: () => ({ unref() {} }), wait: async () => undefined });
  const sessions = await bridge.listSessions(config);
  assert.deepEqual(sessions[0], { id: 'wxid_a', name: '甲', type: 'private', remarkName: '鱼甲' });
  assert.equal((await bridge.listMessages(config, sessions[0])).at(0)?.text, '已付款');
});

test('配置源码目录时自动启动 WeFlow 开发进程', async () => {
  let started = '';
  let checks = 0;
  const bridge = new WeFlowBridge({
    fetch: async () => new Response(JSON.stringify({ status: 'ok' }), { status: checks++ > 0 ? 200 : 503 }),
    spawn: (target) => { started = target; return { unref() {} }; },
    wait: async () => undefined,
  });
  await bridge.ensureRunning({ executablePath: '', sourcePath: 'D:/WeFlow', baseUrl: 'http://127.0.0.1:5031', apiToken: '', autoStart: true });
  assert.equal(started, 'D:/WeFlow');
});

test('启动源码版 WeFlow 前自动开启 HTTP API', async () => {
  const appData = await mkdtemp(join(tmpdir(), 'cy-grad-compass-'));
  const previous = process.env.APPDATA;
  process.env.APPDATA = appData;
  await mkdir(join(appData, 'WeFlow'), { recursive: true });
  await writeFile(join(appData, 'WeFlow', 'WeFlow-config.json'), JSON.stringify({ httpApiEnabled: false, httpApiToken: '' }));
  let checks = 0;
  try {
    const bridge = new WeFlowBridge({ fetch: async () => new Response('{}', { status: checks++ > 0 ? 200 : 503 }), spawn: () => ({ unref() {} }), wait: async () => undefined });
    const runtime = { sourcePath: 'D:/WeFlow', executablePath: '', baseUrl: 'http://127.0.0.1:5031', apiToken: '', autoStart: true };
    await bridge.ensureRunning(runtime);
    const saved = JSON.parse(await readFile(join(appData, 'WeFlow', 'WeFlow-config.json'), 'utf8'));
    assert.equal(saved.httpApiEnabled, true);
    assert.equal(saved.httpApiToken, runtime.apiToken);
    assert.ok(runtime.apiToken.length > 20);
  } finally {
    if (previous === undefined) delete process.env.APPDATA; else process.env.APPDATA = previous;
    await rm(appData, { recursive: true, force: true });
  }
});
