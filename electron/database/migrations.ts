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
  // 中文注释：开发会话与项目建立外键，项目被删除时由业务层决定是否允许清理会话。
  `CREATE TABLE IF NOT EXISTS development_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    codex_thread_id TEXT,
    phase TEXT NOT NULL CHECK (phase IN ('discussion', 'development')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );`,
  `CREATE TABLE IF NOT EXISTS development_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES development_sessions(id)
  );`,
  `CREATE TABLE IF NOT EXISTS deal_candidates (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    session_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    confidence REAL NOT NULL,
    amount REAL,
    deal_time INTEGER,
    evidence_json TEXT NOT NULL,
    matched_folder_json TEXT,
    status TEXT NOT NULL CHECK (status IN ('candidate', 'confirmed', 'ignored')),
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    session_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    folder_path TEXT,
    confirmed_at INTEGER NOT NULL,
    transactions_json TEXT NOT NULL,
    maintenance_json TEXT NOT NULL,
    evidence_json TEXT NOT NULL
  );`,
];

// 中文注释：按顺序执行迁移，幂等设计保证重复启动不会报错。
export function runMigrations(database: DatabaseSync): void {
  for (const statement of MIGRATIONS) {
    database.exec(statement);
  }
}
