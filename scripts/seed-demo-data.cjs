// 中文注释：向本地数据库写入演示项目，便于手动验证统计卡片与项目列表，运行方式 npm run seed。
// 此脚本可重复运行：先删除旧的 demo- 前缀记录再写入，不会与真实项目冲突。
// 使用 CommonJS：主进程统一编译为 CommonJS，保证 require('electron') 返回内置模块。
const { app } = require('electron');
const { join } = require('node:path');
const { closeDatabase, openDatabase } = require('../dist-electron/database/connection.js');
const { getDatabaseFilePath } = require('../dist-electron/database/paths.js');
const { ProjectRepository } = require('../dist-electron/database/project-repository.js');

const DAY = 24 * 60 * 60 * 1000;

// 中文注释：daysAgo 越小创建时间越新，用于验证“最近项目按创建时间倒序”的展示逻辑。
const DEMO_PROJECTS = [
  { name: '毕业设计指南针', status: 'in-progress', daysAgo: 0 },
  { name: '论文查重系统', status: 'in-progress', daysAgo: 3 },
  { name: '校园二手交易平台', status: 'completed', daysAgo: 6 },
  { name: '在线考试系统', status: 'completed', daysAgo: 9 },
  { name: '图书馆座位预约', status: 'archived', daysAgo: 12 },
  { name: '课程表助手', status: 'archived', daysAgo: 15 },
  { name: '健康打卡小程序', status: 'in-progress', daysAgo: 18 },
];

function main() {
  const database = openDatabase(getDatabaseFilePath());
  const repository = new ProjectRepository(database);

  // 中文注释：清理上次的演示数据，保证重复运行不触发 path 唯一约束冲突。
  database.prepare("DELETE FROM projects WHERE id LIKE 'demo-%'").run();

  const now = Date.now();
  for (const [index, demo] of DEMO_PROJECTS.entries()) {
    const createdAt = new Date(now - demo.daysAgo * DAY).toISOString();
    repository.insert({
      id: `demo-${index + 1}`,
      name: demo.name,
      path: join(app.getPath('documents'), 'demo-projects', demo.name),
      status: demo.status,
      templateId: 'template-default',
      createdAt,
      updatedAt: createdAt,
    });
  }

  const statistics = repository.getStatistics();
  console.log(
    `已写入 ${DEMO_PROJECTS.length} 个演示项目：总数 ${statistics.total}，进行中 ${statistics.inProgress}，已完成 ${statistics.completed}，已归档 ${statistics.archived}`,
  );
  closeDatabase(database);
}

app
  .whenReady()
  .then(main)
  .catch((error) => {
    console.error('写入演示数据失败', error);
    process.exitCode = 1;
  })
  .finally(() => {
    app.quit();
  });
