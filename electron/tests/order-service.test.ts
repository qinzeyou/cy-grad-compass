import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from '../database/connection.js';
import { OrderService } from '../orders/order-service.js';
import { createAnalysisDebug, recordAnalysisStep, shouldUseWeFlow } from '../orders/order-service.js';
import { writeWechatConfig } from '../wechat/wechat-config.js';

test('分析调试记录保存阶段详情且不记录密钥', () => {
  const debug = createAnalysisDebug(123);
  recordAnalysisStep(debug, 'config', '配置已读取', { accountDir: 'D:/wxid', hasDecryptKey: true });
  assert.deepEqual(debug.steps, [{ stage: 'config', message: '配置已读取', details: { accountDir: 'D:/wxid', hasDecryptKey: true } }]);
  assert.equal(JSON.stringify(debug).includes('decryptKey'), false);
  assert.equal(JSON.stringify(debug).includes('apiKey'), false);
});

test('成单分析始终使用当前项目内置 WCDB，不启动 WeFlow', () => {
  assert.equal(shouldUseWeFlow({ enabled: false }, { apiToken: '', sourcePath: '', executablePath: '' }), false);
  assert.equal(shouldUseWeFlow({ enabled: true }, { apiToken: 'token', sourcePath: 'D:/WeFlow', executablePath: '' }), false);
});

test('服务删除候选和订单时校验记录存在', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const service = new OrderService(database, dir);
    database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('candidate-1', 's1', '客户', '客户', '项目', 0.9, 100, 1, '[]', null, 'candidate', new Date().toISOString());
    database.prepare(`INSERT INTO orders (id, customer_name, session_id, project_name, folder_path, confirmed_at, transactions_json, maintenance_json, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('order-1', '客户', 's1', '项目', 'C:/projects/项目', 1, '[]', '[]', '[]');
    service.deleteCandidate('candidate-1');
    service.deleteOrder('order-1');
    assert.equal(service.dashboard().candidates.length, 0);
    assert.equal(service.dashboard().orders.length, 0);
    assert.throws(() => service.deleteCandidate('missing'), /待确认线索/);
    assert.throws(() => service.deleteOrder('missing'), /订单不存在/);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('读取看板时清理重复待成单记录', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const evidence = JSON.stringify([{ id: 'm1', sessionId: 's1', sessionName: '客户', senderName: '客户', isSelf: false, text: '已付款500元', sentAt: 100 }]);
    const insert = database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('duplicate-a', 's1', '客户', '客户', '项目', 0.8, 500, 100, evidence, null, 'candidate', '2026-01-01T00:00:00.000Z');
    insert.run('duplicate-b', 's1', '客户', '客户', '项目', 0.9, 500, 100, evidence, null, 'candidate', '2026-01-02T00:00:00.000Z');
    const service = new OrderService(database, dir);
    assert.equal(service.dashboard().candidates.length, 1);
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM deal_candidates WHERE status='candidate'").get() as { count: number }).count, 1);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('读取看板时清理没有会话和聊天证据的未知客户候选，并按成交时间倒序', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const insert = database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('invalid', '', '', '未知客户', '项目', 0.9, null, null, '[]', null, 'candidate', new Date().toISOString());
    const evidence = (id: string, sentAt: number) => JSON.stringify([{ id, sessionId: 's1', sessionName: '客户', senderName: '客户', isSelf: false, text: '已付款', sentAt }]);
    insert.run('newer', 's1', '客户', '客户', '项目', 0.9, 100, 200, evidence('m2', 200), null, 'candidate', new Date().toISOString());
    insert.run('older', 's2', '客户2', '客户2', '项目', 0.9, 100, 100, evidence('m1', 100), null, 'candidate', new Date().toISOString());
    const service = new OrderService(database, dir);
    assert.deepEqual(service.dashboard().candidates.map((candidate) => candidate.id), ['newer', 'older']);
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM deal_candidates WHERE status='candidate'").get() as { count: number }).count, 2);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('分析失败时仍保留已结束的调试记录', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const service = new OrderService(database, dir);
    await assert.rejects(() => service.analyze(), /微信账号目录和解密 Key/);
    const debug = service.getAnalysisDebug();
    assert.ok(debug);
    assert.ok(debug.finishedAt !== null);
    assert.equal(debug.steps[0]?.stage, 'config');
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('确认成单可以关联已有文件夹或不创建文件夹', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  const projectsRoot = join(dir, 'projects');
  const existing = join(projectsRoot, '2026', '01-01_已有项目');
  await mkdir(existing, { recursive: true });
  await writeWechatConfig(dir, { accountDir: 'D:/wx', decryptKey: 'key', enabled: false, remarkPrefixes: ['鱼'], selectedSessionIds: [], projectsRoot, folderTemplate: '{MM-DD}_{projectName}' });
  try {
    const service = new OrderService(database, dir);
    const insert = (id: string) => database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, 's1', '客户', '客户', '项目', 0.9, 800, 1, '[]', null, 'candidate', new Date().toISOString());
    insert('existing');
    assert.equal((await service.confirmCandidate('existing', { projectName: '项目', customerName: '客户', confirmedAt: 1, amount: 800, folderMode: 'existing', folderPath: existing })).folderPath, existing);
    insert('none');
    assert.equal((await service.confirmCandidate('none', { projectName: '项目', customerName: '客户', confirmedAt: 1, amount: 800, folderMode: 'none' })).folderPath, existing);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('确认成单保留微信备注、昵称和头像供订单台账展示', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  const projectsRoot = join(dir, 'projects');
  await writeWechatConfig(dir, { accountDir: 'D:/wx', decryptKey: 'key', enabled: false, remarkPrefixes: ['鱼'], selectedSessionIds: [], projectsRoot, folderTemplate: '{MM-DD}_{projectName}' });
  try {
    const service = new OrderService(database, dir);
    database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at, nickname, remark_name, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('candidate-contact', 's1', '客户', 'wxid-user', '项目', 0.9, 800, 1, '[]', null, 'candidate', new Date().toISOString(), '微信名称', '鱼02-28_美妆预约', '/avatar.png');
    const order = await service.confirmCandidate('candidate-contact', { projectName: '项目', customerName: '', confirmedAt: 1, amount: 800, folderMode: 'none' });
    assert.equal(order.customerName, '鱼02-28_美妆预约');
    assert.equal((order as unknown as { nickname?: string }).nickname, '微信名称');
    assert.equal((order as unknown as { remarkName?: string }).remarkName, '鱼02-28_美妆预约');
    assert.equal((order as unknown as { avatarUrl?: string }).avatarUrl, '/avatar.png');
    const saved = service.dashboard().orders[0] as unknown as { nickname?: string; remarkName?: string; avatarUrl?: string };
    assert.equal(saved.nickname, '微信名称');
    assert.equal(saved.remarkName, '鱼02-28_美妆预约');
    assert.equal(saved.avatarUrl, '/avatar.png');
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('同一客户确认不同交易时合并为一条订单台账并按最近交易时间更新', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  const projectsRoot = join(dir, 'projects');
  await writeWechatConfig(dir, { accountDir: 'D:/wx', decryptKey: 'key', enabled: false, remarkPrefixes: ['鱼'], selectedSessionIds: [], projectsRoot, folderTemplate: '{MM-DD}_{projectName}' });
  try {
    const service = new OrderService(database, dir);
    const insert = database.prepare(`INSERT INTO deal_candidates (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('candidate-1', 's1', '客户', '客户', '项目一', 0.9, 500, 100, JSON.stringify([{ id: 'm1', sessionId: 's1', sessionName: '客户', senderName: '客户', isSelf: false, text: '已付款500元', sentAt: 100 }]), null, 'candidate', new Date().toISOString());
    insert.run('candidate-2', 's1', '客户', '客户', '项目二', 0.9, 300, 200, JSON.stringify([{ id: 'm2', sessionId: 's1', sessionName: '客户', senderName: '客户', isSelf: false, text: '已付款300元', sentAt: 200 }]), null, 'candidate', new Date().toISOString());
    await service.confirmCandidate('candidate-1', { projectName: '项目一', customerName: '客户', confirmedAt: 100, amount: 500, folderMode: 'none' });
    const merged = await service.confirmCandidate('candidate-2', { projectName: '项目二', customerName: '客户', confirmedAt: 200, amount: 300, folderMode: 'none' });
    assert.equal(service.dashboard().orders.length, 1);
    assert.deepEqual(merged.transactions.map((item) => item.amount), [500, 300]);
    assert.equal(merged.confirmedAt, 200);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('读取看板时合并历史同客户订单并按最近交易时间排序', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-service-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const insert = database.prepare(`INSERT INTO orders (id, customer_name, session_id, project_name, folder_path, confirmed_at, transactions_json, maintenance_json, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const tx = (id: string, amount: number, occurredAt: number) => JSON.stringify([{ id, type: 'initial', amount, occurredAt, note: '', evidenceMessageIds: [] }]);
    insert.run('order-old', '客户', 's1', '项目一', null, 100, tx('t1', 500, 100), '[]', '[]');
    insert.run('order-new', '客户', 's1', '项目二', null, 300, tx('t2', 300, 300), '[]', '[]');
    insert.run('order-other', '客户2', 's2', '项目三', null, 200, tx('t3', 200, 200), '[]', '[]');
    const service = new OrderService(database, dir);
    const dashboard = service.dashboard();
    assert.equal(dashboard.orders.length, 2);
    assert.deepEqual(dashboard.orders[0]?.transactions.map((item) => item.amount), [500, 300]);
    assert.equal(dashboard.orders[0]?.sessionId, 's1');
    assert.equal((database.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count, 2);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});
