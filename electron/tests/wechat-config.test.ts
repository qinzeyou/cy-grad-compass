import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canConnectWechat, DEFAULT_WECHAT_CONFIG, normalizeWechatConfig, toWechatConfigDto } from '../wechat/wechat-config.js';

test('微信配置缺失时使用默认规则', () => {
  assert.deepEqual(normalizeWechatConfig(null), DEFAULT_WECHAT_CONFIG);
});

test('微信配置只返回 hasDecryptKey，不泄露解密 Key', () => {
  const dto = toWechatConfigDto({ ...DEFAULT_WECHAT_CONFIG, decryptKey: 'secret' });
  assert.equal(dto.hasDecryptKey, true);
  assert.equal('decryptKey' in dto, false);
});

test('只有账号目录和解密 Key 都存在时才允许连接', () => {
  assert.equal(canConnectWechat(DEFAULT_WECHAT_CONFIG), false);
  assert.equal(canConnectWechat({ ...DEFAULT_WECHAT_CONFIG, accountDir: 'C:/wx', decryptKey: 'a'.repeat(64) }), true);
});
