import type { DatabaseSync } from 'node:sqlite';

// 中文注释：建表语句与《项目统计功能开发文档》《项目开发与管理功能开发文档》中的数据模型保持一致。
// status 使用 CHECK 约束，从数据库层面保证只写入合法状态。
const MIGRATIONS: string[] = [
  // 中文注释：模板表保留 template_id 外键能力，首版只写入一条固定 id 的默认模板。
  `CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stored_path TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('in-progress', 'completed', 'archived')),
    template_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];

// 中文注释：按顺序执行迁移，幂等设计保证重复启动不会报错。
export function runMigrations(database: DatabaseSync): void {
  for (const statement of MIGRATIONS) {
    database.exec(statement);
  }
}
