import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseWeFlow } from '../orders/order-service.js';

test('未启用旧版监听时默认使用 WeFlow 数据源', () => {
  assert.equal(shouldUseWeFlow({ enabled: false }, { apiToken: '', sourcePath: '', executablePath: '' }), true);
  assert.equal(shouldUseWeFlow({ enabled: true }, { apiToken: '', sourcePath: '', executablePath: '' }), false);
  assert.equal(shouldUseWeFlow({ enabled: true }, { apiToken: 'token', sourcePath: '', executablePath: '' }), true);
});
