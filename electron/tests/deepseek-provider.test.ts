// 中文注释：DeepSeek 连通性测试服务测试。通过替换 globalThis.fetch 模拟
// 成功、HTTP 错误、超时、非 JSON、缺字段与网络异常，断言错误码分类、
// 请求地址、Bearer 头、非流式请求体以及 API Key 脱敏与正文截断。
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import type { StoredAiConfig } from '../ai/ai-types.js';
import { testDeepSeekConnection } from '../ai/deepseek-provider.js';

const VALID_CONFIG: StoredAiConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiBaseUrl: 'https://api.deepseek.com',
  apiKey: 'sk-test-secret-key',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('成功响应返回 ok，并按约定发起 DeepSeek 请求', async (t) => {
  const captured: { url: string; headers: HeadersInit | undefined; body: string } = { url: '', headers: undefined, body: '' };
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(input);
    captured.headers = init?.headers;
    captured.body = String(init?.body ?? '');
    return jsonResponse({ choices: [{ message: { content: '你好' } }] });
  });
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.provider, 'deepseek');
  assert.equal(result.model, 'deepseek-chat');
  assert.equal(typeof result.elapsedMs, 'number');
  assert.ok(result.elapsedMs >= 0);

  assert.equal(captured.url, 'https://api.deepseek.com/chat/completions');
  const headers = new Headers(captured.headers);
  assert.equal(headers.get('Authorization'), 'Bearer sk-test-secret-key');
  assert.equal(headers.get('Content-Type'), 'application/json');
  const body = JSON.parse(captured.body) as { model: string; stream: boolean };
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.stream, false);
});

test('API 地址末尾斜杠不影响拼接', async (t) => {
  let capturedUrl = '';
  mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    capturedUrl = String(input);
    return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
  });
  t.after(() => mock.restoreAll());

  await testDeepSeekConnection({ ...VALID_CONFIG, apiBaseUrl: 'https://api.deepseek.com/' });
  assert.equal(capturedUrl, 'https://api.deepseek.com/chat/completions');
});

test('未配置 API Key 返回 AI_CONFIG 且不发起请求', async (t) => {
  let callCount = 0;
  mock.method(globalThis, 'fetch', async () => {
    callCount += 1;
    return jsonResponse({});
  });
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection({ ...VALID_CONFIG, apiKey: '   ' });
  assert.deepEqual(result, { ok: false, code: 'AI_CONFIG', message: '尚未配置 API Key' });
  assert.equal(callCount, 0);
});

test('请求超过超时时间返回 AI_TIMEOUT', async (t) => {
  mock.method(
    globalThis,
    'fetch',
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
      }),
  );
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG, { timeoutMs: 30 });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_TIMEOUT');
  }
});

test('HTTP 非 2xx 返回 AI_HTTP，保留状态码并脱敏正文', async (t) => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'invalid key sk-test-secret-key' } }), { status: 401 }));
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_HTTP');
    assert.match(result.message, /401/);
    assert.equal(result.message.includes('sk-test-secret-key'), false);
  }
});

test('响应不是合法 JSON 返回 AI_RESPONSE', async (t) => {
  mock.method(globalThis, 'fetch', async () => new Response('<html>oops</html>', { status: 200 }));
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_RESPONSE');
  }
});

test('缺少 choices[0].message.content 返回 AI_RESPONSE', async (t) => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ choices: [{ message: {} }] }));
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_RESPONSE');
  }
});

test('网络异常返回 AI_NETWORK', async (t) => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_NETWORK');
  }
});

test('错误正文被截断，避免超长文本刷屏', async (t) => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'x'.repeat(2000) }), { status: 500 }));
  t.after(() => mock.restoreAll());

  const result = await testDeepSeekConnection(VALID_CONFIG);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'AI_HTTP');
    assert.ok(result.message.length < 500, `错误消息过长：${result.message.length}`);
  }
});
