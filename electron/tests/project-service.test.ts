// 中文注释：项目服务测试。用真实临时目录验证复制生成、重复目录拒绝、失败清理与更新行为，
// 覆盖文档测试清单中的第 2-8 条。
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from '../database/connection.js';
import { ProjectRepository } from '../database/project-repository.js';
import { TemplateRepository } from '../database/template-repository.js';
import { ProjectService } from '../services/project-service.js';
import { TemplateService } from '../services/template-service.js';
import type { ProjectStatus } from '../shared/project-types.js';

// 中文注释：模拟 insert 失败的仓储，用于验证“数据库写入失败时清理临时项目目录”。
class FailingInsertRepository extends ProjectRepository {
  override insert(): void {
    throw new Error('模拟数据库写入失败');
  }
}

function createTestContext() {
  const directory = mkdtempSync(join(tmpdir(), 'compass-prj-test-'));
  const database = openDatabase(join(directory, 'test.db'));
  const templateRepository = new TemplateRepository(database);
  const templateService = new TemplateService(templateRepository, join(directory, 'templates'));
  const service = new ProjectService(new ProjectRepository(database), templateRepository);
  return {
    directory,
    database,
    service,
    templateService,
    cleanup: () => {
      closeDatabase(database);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

// 中文注释：导入一个包含嵌套目录与隐藏文件的默认模板，供生成项目使用。
async function importDefaultTemplate(context: ReturnType<typeof createTestContext>): Promise<void> {
  const source = join(context.directory, 'template-src');
  mkdirSync(join(source, 'nested'), { recursive: true });
  writeFileSync(join(source, 'README.md'), '# demo');
  writeFileSync(join(source, '.env.local'), 'SECRET=1');
  writeFileSync(join(source, 'nested', 'index.ts'), 'export {};');
  await context.templateService.importTemplate(source);
}

test('生成项目会复制嵌套与隐藏文件并写入记录', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(target);

    const project = await context.service.createProject({ name: '论文答辩系统', targetDirectory: target });
    const projectPath = join(target, '论文答辩系统');

    // 中文注释：模板只被复制，不被修改；嵌套与隐藏文件都要保留。
    assert.ok(existsSync(projectPath));
    assert.equal(readFileSync(join(projectPath, 'README.md'), 'utf8'), '# demo');
    assert.equal(readFileSync(join(projectPath, '.env.local'), 'utf8'), 'SECRET=1');
    assert.equal(readFileSync(join(projectPath, 'nested', 'index.ts'), 'utf8'), 'export {};');
    assert.equal(project.status, 'in-progress');
    assert.equal(project.templateId, 'default');

    // 中文注释：生成成功后项目立即出现在列表中。
    const list = context.service.list({});
    assert.equal(list.length, 1);
    assert.equal(list[0].path, projectPath);
  } finally {
    context.cleanup();
  }
});

test('目标目录存在同名项目时拒绝且不覆盖任何文件', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(join(target, 'existing-project'), { recursive: true });
    writeFileSync(join(target, 'existing-project', 'keep.txt'), 'keep');

    await assert.rejects(
      context.service.createProject({ name: 'existing-project', targetDirectory: target }),
      /项目目录已存在/,
    );

    // 中文注释：已有目录内容原样保留，且没有产生项目记录。
    assert.equal(readFileSync(join(target, 'existing-project', 'keep.txt'), 'utf8'), 'keep');
    assert.equal(context.service.list({}).length, 0);
  } finally {
    context.cleanup();
  }
});

test('空名称与非法名称被拒绝且不产生任何目录', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(target);

    for (const name of ['', '   ', 'a/b', 'con', 'name.' ]) {
      await assert.rejects(context.service.createProject({ name, targetDirectory: target }));
    }
    assert.equal(context.service.list({}).length, 0);
    assert.equal(readdirSync(target).length, 0);
  } finally {
    context.cleanup();
  }
});

test('未导入模板时生成项目被拒绝', async () => {
  const context = createTestContext();
  try {
    const target = join(context.directory, 'target');
    mkdirSync(target);
    await assert.rejects(
      context.service.createProject({ name: 'demo', targetDirectory: target }),
      /请先导入代码模板/,
    );
  } finally {
    context.cleanup();
  }
});

test('目标目录不存在时生成项目被拒绝', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    await assert.rejects(
      context.service.createProject({ name: 'demo', targetDirectory: join(context.directory, 'nope') }),
      /目标目录不存在/,
    );
  } finally {
    context.cleanup();
  }
});

test('数据库写入失败时清理临时项目目录且不留记录', async () => {
  const context = createTestContext();
  try {
    const failingService = new ProjectService(
      new FailingInsertRepository(context.database),
      new TemplateRepository(context.database),
    );
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(target);

    await assert.rejects(
      failingService.createProject({ name: 'cleanup-me', targetDirectory: target }),
      /项目记录保存失败/,
    );

    // 中文注释：记录未保存就不留半成品目录，目标目录恢复为空。
    assert.ok(!existsSync(join(target, 'cleanup-me')));
    assert.equal(readdirSync(target).length, 0);
    assert.equal(context.service.list({}).length, 0);
  } finally {
    context.cleanup();
  }
});

test('重命名与状态修改正确且返回最新统计', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(target);
    const project = await context.service.createProject({ name: 'first-name', targetDirectory: target });

    // 中文注释：重命名只改记录，不移动磁盘目录。
    const renamed = context.service.updateProject({ id: project.id, name: 'second-name' });
    assert.equal(renamed.project.name, 'second-name');
    assert.equal(renamed.project.path, project.path);

    const statusChanged = context.service.updateProject({ id: project.id, status: 'completed' });
    assert.equal(statusChanged.project.status, 'completed');
    assert.equal(statusChanged.statistics.completed, 1);

    // 中文注释：非法状态与不存在的项目都被拒绝。
    assert.throws(
      () => context.service.updateProject({ id: project.id, status: 'deleted' as ProjectStatus }),
      /非法/,
    );
    assert.throws(
      () => context.service.updateProject({ id: 'missing-id', status: 'in-progress' }),
      /项目不存在/,
    );
  } finally {
    context.cleanup();
  }
});

test('按 id 查询项目，不存在时报业务错误', async () => {
  const context = createTestContext();
  try {
    await importDefaultTemplate(context);
    const target = join(context.directory, 'target');
    mkdirSync(target);
    const project = await context.service.createProject({ name: 'query-me', targetDirectory: target });

    assert.equal(context.service.getProject(project.id).path, project.path);
    assert.throws(() => context.service.getProject('missing-id'), /项目不存在/);
  } finally {
    context.cleanup();
  }
});

test('登记本地项目目录会复用同一路径的项目记录', async () => {
  const context = createTestContext();
  try {
    const existingPath = join(context.directory, '已有项目');
    mkdirSync(existingPath);

    const first = await context.service.registerExistingDirectory(existingPath);
    const second = await context.service.registerExistingDirectory(existingPath);

    assert.equal(first.name, '已有项目');
    assert.equal(first.path, existingPath);
    assert.equal(first.templateId, 'external');
    assert.equal(second.id, first.id);
    assert.equal(context.service.list({}).length, 1);
  } finally {
    context.cleanup();
  }
});
