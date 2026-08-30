// 中文注释：项目名称校验规则测试，覆盖文档测试清单中的空名称、非法名称与保留名称。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertValidProjectName } from '../shared/validation.js';

test('合法的项目名称返回去除首尾空格后的结果', () => {
  assert.equal(assertValidProjectName('  论文答辩系统  '), '论文答辩系统');
  assert.equal(assertValidProjectName('grad-compass'), 'grad-compass');
  assert.equal(assertValidProjectName('A'.repeat(80)), 'A'.repeat(80));
});

test('空名称与纯空格名称被拒绝', () => {
  assert.throws(() => assertValidProjectName(''), /不能为空/);
  assert.throws(() => assertValidProjectName('   '), /不能为空/);
});

test('超过 80 字符的名称被拒绝', () => {
  assert.throws(() => assertValidProjectName('A'.repeat(81)), /80/);
});

test('包含路径非法字符的名称被拒绝', () => {
  for (const name of ['a<b', 'a>b', 'a:b', 'a"b', 'a/b', 'a\\b', 'a|b', 'a?b', 'a*b', 'a\u0000b']) {
    assert.throws(() => assertValidProjectName(name), /路径字符/, `应拒绝：${name}`);
  }
});

test('Windows 保留设备名被拒绝', () => {
  for (const name of ['CON', 'con', 'PRN', 'AUX', 'NUL', 'COM1', 'com7', 'LPT9', 'con.txt']) {
    assert.throws(() => assertValidProjectName(name), /保留/, `应拒绝：${name}`);
  }
});

test('以点结尾的名称被拒绝，尾随空格会被去除而不是拒绝', () => {
  // 中文注释：Windows 不允许目录名以点结尾，必须拒绝。
  assert.throws(() => assertValidProjectName('project.'), /结尾/);
  assert.throws(() => assertValidProjectName('project..'), /结尾/);
  // 中文注释：尾随空格是名称规范化的一部分，按文档“去除首尾空格”处理。
  assert.equal(assertValidProjectName('project '), 'project');
});
