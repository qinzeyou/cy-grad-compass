import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDeals, analyzeDealsDetailed } from '../orders/deal-analyzer.js';

test('本地规则可以从同一会话识别多个历史成交', async () => {
  const messages = [
    { id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '确定做校园跑腿，定金500', sentAt: Date.UTC(2026, 0, 5) },
    { id: '2', sessionId: 'wxid-a', sessionName: '客户A', senderName: '我', isSelf: true, text: '好的', sentAt: Date.UTC(2026, 0, 5) },
    { id: '3', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '再加一个数据看板，已转账300', sentAt: Date.UTC(2026, 1, 8) },
  ];
  const result = await analyzeDeals(messages, [], null);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.amount), [500, 300]);
});

test('本地规则识别常见到账表达和金额后缀', async () => {
  const result = await analyzeDeals([{ id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '收到款了，500元，今天开工', sentAt: Date.UTC(2026, 0, 5) }], [], null);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 500);
});

test('成交消息本身没有金额时从相邻聊天识别金额', async () => {
  const result = await analyzeDeals([
    { id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '我', isSelf: true, text: '这个项目报价 800 元', sentAt: 1 },
    { id: '2', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '可以，就这个，开始做吧', sentAt: 2 },
  ], [], null);
  assert.equal(result[0]?.amount, 800);
});

test('同一段聊天中的重复成交关键词合并为一条候选', async () => {
  const result = await analyzeDeals([
    { id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '可以，就这个，已付款500元', sentAt: 1 },
    { id: '2', sessionId: 'wxid-a', sessionName: '客户A', senderName: '我', isSelf: true, text: '收到，已经到账，马上开始做', sentAt: 2 },
  ], [], null);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.amount, 500);
});

test('同一成交时间和金额的项目名变体合并为一条候选', async () => {
  const base = { sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '已付款500元', sentAt: 1000 };
  const result = await analyzeDeals([
    { ...base, id: '1' },
    { ...base, id: '2', text: '已到账500元' },
  ], [], null);
  assert.equal(result.length, 1);
});

test('同一用户同一天不同金额的交易保留为两条候选', async () => {
  const result = await analyzeDeals([
    { id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '项目已付款500元', sentAt: 1000 },
    { id: '2', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '另一笔已付款300元', sentAt: 2000 },
  ], [], null);
  assert.equal(result.length, 2);
});

test('AI 分析会把长会话拆成多个批次', async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async (_input, init) => {
    callCount += 1;
    const body = JSON.parse(String(init?.body));
    const batch = JSON.parse(body.messages[1].content);
    const message = batch[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ deals: [{ projectName: `项目${callCount}`, amount: callCount * 100, confidence: 0.9, dealTime: message.sentAt, messageIds: [message.id] }] }) } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const messages = Array.from({ length: 240 }, (_, index) => ({ id: String(index), sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: `消息${index}`, sentAt: Date.UTC(2026, 0, 1) + index * 1000 }));
    const result = await analyzeDeals(messages, [], { provider: 'deepseek', apiKey: 'key', apiBaseUrl: 'https://example.test', model: 'test' });
    assert.equal(callCount, 2);
    assert.equal(result.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('AI 请求失败时返回可见的降级原因，而不是静默伪装成 AI 结果', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('bad request', { status: 400 });
  try {
    const result = await analyzeDealsDetailed(
      [{ id: '1', sessionId: 'wxid-a', sessionName: '客户A', senderName: '客户A', isSelf: false, text: '已付款500元', sentAt: 1 }],
      [],
      { provider: 'deepseek', apiKey: 'key', apiBaseUrl: 'https://example.test', model: 'test' },
    );
    assert.equal(result.diagnostics.mode, 'heuristic-fallback');
    assert.match(result.diagnostics.fallbackReason || '', /HTTP 400/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
