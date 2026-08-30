// 中文注释：数据库连接管理。本模块不依赖 Electron，便于在纯 Node 环境（自动化测试）中直接使用。
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from './migrations.js';

export type AppDatabase = DatabaseSync;

// 中文注释：打开本地 SQLite 数据库。数据库文件所在目录不存在时先创建，避免首次启动失败。
export function openDatabase(dbPath: string): AppDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  // 中文注释：显式开启外键约束，避免开发会话残留指向不存在的项目。
  database.exec('PRAGMA foreign_keys = ON;');
  // 中文注释：WAL 模式提升并发读性能且崩溃恢复更安全，适合桌面单用户读写场景。
  database.exec('PRAGMA journal_mode = WAL;');
  runMigrations(database);
  return database;
}

export function closeDatabase(database: AppDatabase): void {
  // 中文注释：防止查询失败后重复关闭同一连接。
  if (database.isOpen) {
    database.close();
  }
}
