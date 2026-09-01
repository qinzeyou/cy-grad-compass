import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFolderName, matchesRemarkPrefix, nextAvailableFolderName, parseFolderName, renderFolderTemplate, summarizeRevenue } from '../orders/order-utils.js';

test('备注名只按鱼或书前缀匹配', () => {
  assert.equal(matchesRemarkPrefix('鱼-张三'), true);
  assert.equal(matchesRemarkPrefix('书店客户'), true);
  assert.equal(matchesRemarkPrefix('小鱼'), false);
});

test('解析现有 MM-DD 项目目录并保留异常目录', () => {
  assert.equal(parseFolderName('04-05_助农惠民小程序', 2025).datePrefix, '04-05');
  assert.equal(parseFolderName('04-40_异常历史目录', 2026).datePrefix, '04-40');
  assert.equal(parseFolderName('无日期目录', 2026).datePrefix, null);
});

test('按成交日期生成默认目录名并处理冲突', () => {
  const date = new Date(2026, 5, 2);
  const base = formatFolderName(date, '客户/校园跑腿');
  assert.equal(base, '06-02_客户-校园跑腿');
  assert.equal(nextAvailableFolderName(base, [base]), '06-02_客户-校园跑腿-2');
});

test('命名模板支持日期和项目名占位符', () => {
  assert.equal(renderFolderTemplate('{YYYY}/{MM-DD}_{projectName}', new Date(2026, 5, 2), '客户/功能'), '2026/06-02_客户-功能');
});

test('收益按首单续单加功能减退款汇总', () => {
  const summary = summarizeRevenue([
    { id: 'o1:t1', type: 'initial', amount: 3000, occurredAt: 1, note: '', evidenceMessageIds: [] },
    { id: 'o1:t2', type: 'follow-up', amount: 500, occurredAt: 2, note: '', evidenceMessageIds: [] },
    { id: 'o1:t3', type: 'refund', amount: 200, occurredAt: 3, note: '', evidenceMessageIds: [] },
  ]);
  assert.deepEqual(summary, { gross: 3500, refunds: 200, net: 3300, orderCount: 1, pendingCandidateCount: 0 });
});
