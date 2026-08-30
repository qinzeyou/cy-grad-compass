// 中文注释：模板服务测试。用真实临时目录验证复制、替换与失败回滚，
// 覆盖文档测试清单中的“导入后副本存在”“删除源目录仍可读取”“复制失败不影响原模板”。
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from '../database/connection.js';
import { TemplateRepository } from '../database/template-repository.js';
import { TemplateService } from '../services/template-service.js';

function createTestContext() {
  const directory = mkdtempSync(join(tmpdir(), 'compass-tpl-test-'));
  const database = openDatabase(join(directory, 'test.db'));
  const repository = new TemplateRepository(database);
  const templatesDir = join(directory, 'templates');
  const service = new TemplateService(repository, templatesDir);
  return {
    directory,
    database,
    service,
    templatesDir,
    cleanup: () => {
      closeDatabase(database);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

// 中文注释：构造包含嵌套目录与隐藏文件的源模板目录，验证复制保留全部内容。
// content 参数用于区分不同模板，便于验证替换/回滚后保留的是哪一个。
function makeSourceDir(root: string, name = 'demo-template', content = '# demo'): string {
  const source = join(root, name);
  mkdirSync(join(source, 'nested'), { recursive: true });
  writeFileSync(join(source, 'README.md'), content);
  writeFileSync(join(source, '.env.local'), 'SECRET=1');
  writeFileSync(join(source, 'nested', 'index.ts'), 'export {};');
  return source;
}

test('导入模板后副本存在且内容完整（含嵌套与隐藏文件）', async () => {
  const context = createTestContext();
  try {
    const source = makeSourceDir(context.directory);
    const template = await context.service.importTemplate(source);

    assert.ok(template.storedPath.startsWith(context.templatesDir));
    assert.equal(readFileSync(join(template.storedPath, 'README.md'), 'utf8'), '# demo');
    assert.equal(readFileSync(join(template.storedPath, '.env.local'), 'utf8'), 'SECRET=1');
    assert.equal(readFileSync(join(template.storedPath, 'nested', 'index.ts'), 'utf8'), 'export {};');
    assert.equal(context.service.getTemplate()?.name, 'demo-template');
  } finally {
    context.cleanup();
  }
});

test('删除源目录后仍可读取模板副本并继续生成项目', async () => {
  const context = createTestContext();
  try {
    const source = makeSourceDir(context.directory);
    const template = await context.service.importTemplate(source);
    rmSync(source, { recursive: true, force: true });

    // 中文注释：模板副本与应用数据同存，源目录删除不影响后续使用。
    assert.ok(existsSync(join(template.storedPath, 'README.md')));
    assert.equal(context.service.getTemplate()?.name, 'demo-template');
  } finally {
    context.cleanup();
  }
});

test('源目录不存在或不是目录时导入被拒绝', async () => {
  const context = createTestContext();
  try {
    await assert.rejects(
      context.service.importTemplate(join(context.directory, 'missing')),
      /源目录不存在/,
    );
    const fileSource = join(context.directory, 'plain-file.txt');
    writeFileSync(fileSource, 'not a directory');
    await assert.rejects(context.service.importTemplate(fileSource), /目录/);
  } finally {
    context.cleanup();
  }
});

test('已存在模板时再次导入被拒绝，需走替换流程', async () => {
  const context = createTestContext();
  try {
    const source = makeSourceDir(context.directory);
    await context.service.importTemplate(source);
    await assert.rejects(context.service.importTemplate(source), /替换/);
  } finally {
    context.cleanup();
  }
});

test('替换模板会切换副本与记录，旧副本被移除', async () => {
  const context = createTestContext();
  try {
    const sourceA = makeSourceDir(context.directory, 'template-a', '# template-a');
    const sourceB = makeSourceDir(context.directory, 'template-b', '# template-b');
    await context.service.importTemplate(sourceA);
    const replaced = await context.service.replaceTemplate(sourceB);

    assert.equal(replaced.name, 'template-b');
    assert.equal(context.service.getTemplate()?.name, 'template-b');
    assert.equal(readFileSync(join(replaced.storedPath, 'README.md'), 'utf8'), '# template-b');
    // 中文注释：替换成功后模板库内不应残留备份或临时目录，只剩正式模板目录。
    assert.deepEqual(readdirSync(context.templatesDir), ['default']);
  } finally {
    context.cleanup();
  }
});

test('数据库写入失败时清理新模板目录并保留旧模板', async () => {
  const context = createTestContext();
  try {
    const sourceA = makeSourceDir(context.directory, 'template-a', '# template-a');
    const first = await context.service.importTemplate(sourceA);
    const sourceB = makeSourceDir(context.directory, 'template-b', '# template-b');

    // 中文注释：关闭数据库让 upsert 失败，验证替换流程回滚到旧模板。
    context.database.close();
    await assert.rejects(context.service.replaceTemplate(sourceB), /模板记录保存失败/);

    // 中文注释：旧模板副本必须原样恢复，新模板与临时/备份目录都被清理。
    assert.equal(readFileSync(join(first.storedPath, 'README.md'), 'utf8'), '# template-a');
    assert.deepEqual(readdirSync(context.templatesDir), ['default']);
  } finally {
    context.cleanup();
  }
});

test('首次导入时数据库写入失败会清理新模板目录', async () => {
  const context = createTestContext();
  try {
    const source = makeSourceDir(context.directory);
    context.database.close();
    await assert.rejects(context.service.importTemplate(source), /模板记录保存失败/);
    assert.ok(!existsSync(join(context.templatesDir, 'default')));
  } finally {
    context.cleanup();
  }
});
