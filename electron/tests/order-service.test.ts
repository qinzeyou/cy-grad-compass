import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldUseWeFlow } from '../orders/order-service.js';

test('成单分析始终使用当前项目内置 WCDB，不启动 WeFlow', () => {
  assert.equal(shouldUseWeFlow({ enabled: false }, { apiToken: '', sourcePath: '', executablePath: '' }), false);
  assert.equal(shouldUseWeFlow({ enabled: true }, { apiToken: 'token', sourcePath: 'D:/WeFlow', executablePath: '' }), false);
});
