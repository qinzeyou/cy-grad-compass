import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WechatService } from '../wechat/wechat-service.js';

test('预初始化 Worker 后禁用监听不会关闭 WCDB', async () => {
  let initialized = 0;
  let stopped = 0;
  const wcdb = {
    setPaths: () => undefined,
    initialize: async () => { initialized += 1; return true; },
    open: async () => true,
    getLastInitError: async () => null,
    getSessions: async () => ({ success: true, sessions: [] }),
    getContactsCompact: async () => ({ success: true, contacts: [] }),
    getAvatarUrls: async () => ({ success: true, map: {} }),
    getMessages: async () => ({ success: true, messages: [] }),
    openMessageCursor: async () => ({ success: true, cursor: 1 }),
    fetchMessageBatch: async () => ({ success: true, rows: [], hasMore: false }),
    closeMessageCursor: async () => ({ success: true }),
    setMonitor: () => undefined,
    isReady: () => true,
    shutdown: async () => { stopped += 1; },
  };
  const service = new WechatService(wcdb as never, { getAppPath: () => 'E:/app', getPath: () => 'C:/user-data' } as never);
  assert.equal(await service.prepare(), true);
  assert.equal(service.isConnected(), false);
  assert.equal(initialized, 1);
  assert.equal(stopped, 0);
});

test('按时间范围分页读取完整消息', async () => {
  let offsets: number[] = [];
  const wcdb = {
    setPaths: () => undefined,
    initialize: async () => true,
    open: async () => true,
    getLastInitError: async () => null,
    getSessions: async () => ({ success: true, sessions: [] }),
    getContactsCompact: async () => ({ success: true, contacts: [] }),
    getAvatarUrls: async () => ({ success: true, map: {} }),
    getMessages: async (_id: string, _limit: number, offset: number) => { offsets.push(offset); return { success: true, messages: offset === 0 ? [{ serverId: '1', createTime: 1767225600, content: '消息1' }, { serverId: '2', createTime: 1767225601, content: '消息2' }] : [] }; },
    openMessageCursor: async () => ({ success: false, error: '游标不可用' }),
    fetchMessageBatch: async () => ({ success: true, rows: [], hasMore: false }),
    closeMessageCursor: async () => ({ success: true }),
    setMonitor: () => undefined,
    isReady: () => true,
    shutdown: async () => undefined,
  };
  const service = new WechatService(wcdb as never, { getAppPath: () => 'E:/app', getPath: () => 'C:/user-data' } as never);
  const messages = await service.listMessages({ id: 'wxid-a', name: '客户A', type: 'private' }, { beginTimestamp: Date.UTC(2026, 0, 1), endTimestamp: Date.UTC(2026, 0, 31) });
  assert.equal(messages.length, 2);
  assert.deepEqual(offsets, [0]);
});

test('未选择日期时保留全部分页消息', async () => {
  const wcdb = {
    setPaths: () => undefined,
    initialize: async () => true,
    open: async () => true,
    getLastInitError: async () => null,
    getSessions: async () => ({ success: true, sessions: [] }),
    getContactsCompact: async () => ({ success: true, contacts: [] }),
    getAvatarUrls: async () => ({ success: true, map: {} }),
    openMessageCursor: async () => ({ success: false, error: '游标不可用' }),
    fetchMessageBatch: async () => ({ success: true, rows: [], hasMore: false }),
    closeMessageCursor: async () => ({ success: true }),
    getMessages: async (_id: string, _limit: number, offset: number) => ({ success: true, messages: offset === 0
      ? Array.from({ length: 1000 }, (_, index) => ({ serverId: String(index + 1), createTime: index + 1, content: index === 0 ? '早期消息' : `消息${index}` }))
      : [{ serverId: '1001', createTime: 1001, content: '最新消息' }] }),
    setMonitor: () => undefined,
    isReady: () => true,
    shutdown: async () => undefined,
  };
  const service = new WechatService(wcdb as never, { getAppPath: () => 'E:/app', getPath: () => 'C:/user-data' } as never);
  const messages = await service.listMessages({ id: 'wxid-a', name: '客户A', type: 'private' });
  assert.equal(messages.length, 1001);
  assert.equal(messages[0].text, '早期消息');
  assert.equal(messages.at(-1)?.text, '最新消息');
});

test('优先使用消息游标并兼容 WCDB 下划线字段', async () => {
  let closed = false;
  const wcdb = {
    setPaths: () => undefined,
    initialize: async () => true,
    open: async () => true,
    getLastInitError: async () => null,
    getSessions: async () => ({ success: true, sessions: [] }),
    getContactsCompact: async () => ({ success: true, contacts: [] }),
    getAvatarUrls: async () => ({ success: true, map: {} }),
    getMessages: async () => ({ success: false, error: '不应调用' }),
    openMessageCursor: async (_id: string, _limit: number, _ascending: boolean, begin: number, end: number) => { assert.equal(begin, 0); assert.equal(end, 0); return { success: true, cursor: 9 }; },
    fetchMessageBatch: async () => ({ success: true, rows: [{ server_id: 'm1', create_time: 1767225600, is_send: 0, sender_username: 'wxid-customer', str_content: '已付款' }], hasMore: false }),
    closeMessageCursor: async () => { closed = true; return { success: true }; },
    setMonitor: () => undefined,
    isReady: () => true,
    shutdown: async () => undefined,
  };
  const service = new WechatService(wcdb as never, { getAppPath: () => 'E:/app', getPath: () => 'C:/user-data' } as never);
  const messages = await service.listMessages({ id: 'wxid-a', name: '客户A', type: 'private' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, '已付款');
  assert.equal(messages[0].id, 'm1');
  assert.equal(closed, true);
});

test('会话没有消息数据库时不阻断整批分析', async () => {
  const wcdb = {
    setPaths: () => undefined,
    initialize: async () => true,
    open: async () => true,
    getLastInitError: async () => null,
    getSessions: async () => ({ success: true, sessions: [] }),
    getContactsCompact: async () => ({ success: true, contacts: [] }),
    getAvatarUrls: async () => ({ success: true, map: {} }),
    openMessageCursor: async () => ({ success: false, error: '创建游标失败: -3（消息数据库未找到）' }),
    fetchMessageBatch: async () => ({ success: true, rows: [], hasMore: false }),
    closeMessageCursor: async () => ({ success: true }),
    getMessages: async () => ({ success: false, error: '获取消息失败: -3' }),
    setMonitor: () => undefined,
    isReady: () => true,
    shutdown: async () => undefined,
  };
  const service = new WechatService(wcdb as never, { getAppPath: () => 'E:/app', getPath: () => 'C:/user-data' } as never);
  assert.deepEqual(await service.listMessages({ id: 'wxid-no-db', name: '无消息库', type: 'private' }), []);
});
