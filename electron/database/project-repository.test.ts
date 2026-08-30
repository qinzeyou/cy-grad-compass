import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closeDatabase, openDatabase } from './connection.js';
import { ProjectRepository } from './project-repository.js';
import { ProjectService } from '../services/project-service.js';
import type { Project, ProjectStatus, ProjectStatusFilter } from '../shared/project-types.js';

// 中文注释：构造最小项目记录，测试只关注统计与查询行为，不关心真实目录。
function makeProject(overrides: Partial<Project> = {}): Project {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.createdAt ?? '2026-01-01T00:00:00.000Z';
  return {
    id,
    name: overrides.name ?? `测试项目 ${id.slice(0, 4)}`,
    path: overrides.path ?? `C:\\demo\\project-${id}`,
    status: overrides.status ?? 'in-progress',
    templateId: overrides.templateId ?? 'template-default',
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  };
}

// 中文注释：每个用例使用独立临时目录，避免用例之间相互影响。
function createTestContext() {
  const directory = mkdtempSync(join(tmpdir(), 'compass-test-'));
  const database = openDatabase(join(directory, 'test.db'));
  const repository = new ProjectRepository(database);
  return {
    directory,
    database,
    repository,
    cleanup: () => {
      closeDatabase(database);
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('空数据库返回四个 0 和空的最近项目', () => {
  const context = createTestContext();
  try {
    const statistics = context.repository.getStatistics();
    assert.equal(statistics.total, 0);
    assert.equal(statistics.inProgress, 0);
    assert.equal(statistics.completed, 0);
    assert.equal(statistics.archived, 0);
    assert.deepEqual(statistics.recentProjects, []);
  } finally {
    context.cleanup();
  }
});

test('插入三种状态的项目后统计数量正确', () => {
  const context = createTestContext();
  try {
    context.repository.insert(makeProject({ status: 'in-progress' }));
    context.repository.insert(makeProject({ status: 'completed' }));
    context.repository.insert(makeProject({ status: 'archived' }));
    const statistics = context.repository.getStatistics();
    assert.equal(statistics.total, 3);
    assert.equal(statistics.inProgress, 1);
    assert.equal(statistics.completed, 1);
    assert.equal(statistics.archived, 1);
    // 中文注释：验收标准要求三种状态数量之和等于项目总数。
    assert.equal(statistics.inProgress + statistics.completed + statistics.archived, statistics.total);
  } finally {
    context.cleanup();
  }
});

test('最近项目最多 5 条且按创建时间倒序', () => {
  const context = createTestContext();
  try {
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    for (let index = 0; index < 7; index += 1) {
      context.repository.insert(
        makeProject({ id: `p-${index}`, createdAt: new Date(base + index * 60_000).toISOString() }),
      );
    }
    const statistics = context.repository.getStatistics();
    assert.equal(statistics.recentProjects.length, 5);
    assert.equal(statistics.recentProjects[0].id, 'p-6');
    const times = statistics.recentProjects.map((project) => Date.parse(project.createdAt));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  } finally {
    context.cleanup();
  }
});

test('关键字只匹配项目名称并忽略首尾空格', () => {
  const context = createTestContext();
  try {
    context.repository.insert(
      makeProject({ id: 'a', name: '论文答辩系统', path: 'C:\\code\\banner-project' }),
    );
    context.repository.insert(
      makeProject({ id: 'b', name: '数据看板', path: 'C:\\code\\banner-else' }),
    );
    // 中文注释：路径里的 banner 不应命中，因为搜索只匹配项目名称。
    const byPathWord = context.repository.list({ keyword: 'banner' });
    assert.equal(byPathWord.length, 0);
    const withSpaces = context.repository.list({ keyword: '  数据  ' });
    assert.deepEqual(withSpaces.map((project) => project.id), ['b']);
  } finally {
    context.cleanup();
  }
});

test('状态筛选只返回对应状态，清空后恢复全部', () => {
  const context = createTestContext();
  try {
    context.repository.insert(makeProject({ id: 'a', status: 'in-progress' }));
    context.repository.insert(makeProject({ id: 'b', status: 'completed' }));
    context.repository.insert(makeProject({ id: 'c', status: 'archived' }));
    const inProgress = context.repository.list({ status: 'in-progress' });
    assert.deepEqual(inProgress.map((project) => project.id), ['a']);
    const all = context.repository.list({});
    assert.equal(all.length, 3);
  } finally {
    context.cleanup();
  }
});

test('列表按更新时间倒序排列', () => {
  const context = createTestContext();
  try {
    context.repository.insert(
      makeProject({ id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    context.repository.insert(
      makeProject({ id: 'new', updatedAt: '2026-06-01T00:00:00.000Z' }),
    );
    const list = context.repository.list({});
    assert.deepEqual(list.map((project) => project.id), ['new', 'old']);
  } finally {
    context.cleanup();
  }
});

test('非法状态不会写入数据库', () => {
  const context = createTestContext();
  try {
    // 中文注释：CHECK 约束从数据库层面拒绝非法状态。
    assert.throws(() => context.repository.insert(makeProject({ status: 'deleted' as ProjectStatus })));
    const service = new ProjectService(context.repository);
    assert.throws(() => service.updateStatus('p-1', 'deleted' as ProjectStatus), /非法/);
    assert.throws(() => service.list({ status: 'deleted' as ProjectStatusFilter }), /非法/);
  } finally {
    context.cleanup();
  }
});

test('更新不存在的项目返回业务错误', () => {
  const context = createTestContext();
  try {
    const service = new ProjectService(context.repository);
    assert.throws(() => service.updateStatus('missing-id', 'in-progress'), /项目不存在/);
  } finally {
    context.cleanup();
  }
});

test('数据库查询失败时服务层返回可读错误且不吞底层异常', () => {
  const context = createTestContext();
  try {
    context.database.close();
    // 中文注释：底层查询直接抛错，不在仓储层吞掉。
    assert.throws(() => context.repository.getStatistics());
    const service = new ProjectService(context.repository);
    assert.throws(() => service.getStatistics(), /统计加载失败/);
    assert.throws(() => service.list({}), /项目列表加载失败/);
  } finally {
    context.cleanup();
  }
});
