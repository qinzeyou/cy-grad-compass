import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase, closeDatabase } from '../database/connection.js';
import { OrderRepository } from '../orders/order-repository.js';

test('删除待确认线索后不再出现在列表中', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-repository-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const repository = new OrderRepository(database);
    repository.saveCandidate({ id: 'candidate-1', sessionId: 's1', sessionName: '客户', customerName: '客户', projectName: '项目', confidence: 0.9, amount: 100, dealTime: 1, evidence: [], matchedFolder: null, status: 'candidate' });
    repository.deleteCandidate('candidate-1');
    assert.deepEqual(repository.listCandidates(), []);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('删除订单后不再出现在列表中且保留文件夹路径字段', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-repository-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const repository = new OrderRepository(database);
    database.prepare(`INSERT INTO orders (id, customer_name, session_id, project_name, folder_path, confirmed_at, transactions_json, maintenance_json, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('order-1', '客户', 's1', '项目', 'C:/projects/2026/01-01_项目', 1, '[]', '[]', '[]');
    assert.equal(repository.getOrder('order-1')?.folderPath, 'C:/projects/2026/01-01_项目');
    repository.deleteOrder('order-1');
    assert.equal(repository.getOrder('order-1'), null);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('删除不存在的候选和订单返回 false', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-repository-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const repository = new OrderRepository(database);
    assert.equal(repository.deleteCandidate('missing-candidate'), false);
    assert.equal(repository.deleteOrder('missing-order'), false);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});

test('忽略候选会记录会话处理水位，供后续新消息重新触发', async () => {
  const dir = await mkdtemp(join(process.env.TEMP || 'C:/Windows/Temp', 'order-repository-'));
  const database = openDatabase(join(dir, 'test.db'));
  try {
    const repository = new OrderRepository(database);
    repository.saveCandidate({ id: 'candidate-ignore', sessionId: 's1', sessionName: '客户', customerName: '客户', projectName: '项目', confidence: 0.9, amount: null, dealTime: 100, evidence: [], matchedFolder: null, status: 'candidate' });
    assert.equal(repository.ignoreCandidate('candidate-ignore', 200), true);
    assert.equal(repository.findLatestIgnoredAt('s1'), 200);
    assert.equal(repository.listCandidates().length, 0);
    assert.equal(repository.ignoreCandidate('missing', 300), false);
  } finally {
    closeDatabase(database);
    await rm(dir, { recursive: true, force: true });
  }
});
