import type { DatabaseSync } from 'node:sqlite';
import type {
  DevelopmentMessage,
  DevelopmentPhase,
  DevelopmentRole,
  DevelopmentSession,
  DevelopmentSessionDetail,
} from './development-types.js';

interface SessionRow {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  codex_thread_id: string | null;
  phase: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

function mapSession(row: SessionRow): DevelopmentSession {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    codexThreadId: row.codex_thread_id,
    phase: row.phase as DevelopmentPhase,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): DevelopmentMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as DevelopmentRole,
    content: row.content,
    createdAt: row.created_at,
  };
}

// 中文注释：开发仓储只负责 SQL 和行映射，输入校验与业务流程由 service 处理。
export class DevelopmentRepository {
  constructor(private readonly database: DatabaseSync) {}

  createSession(session: Omit<DevelopmentSession, 'projectName' | 'codexThreadId'>): void {
    this.database.prepare(
      `INSERT INTO development_sessions (id, project_id, title, phase, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(session.id, session.projectId, session.title, session.phase, session.createdAt, session.updatedAt);
  }

  listSessions(): DevelopmentSession[] {
    const rows = this.database.prepare(
      `SELECT s.id, s.project_id, p.name AS project_name, s.title, s.codex_thread_id,
              s.phase, s.created_at, s.updated_at
       FROM development_sessions s JOIN projects p ON p.id = s.project_id
       ORDER BY s.updated_at DESC, s.id DESC`,
    ).all() as unknown as SessionRow[];
    return rows.map(mapSession);
  }

  getSession(id: string): DevelopmentSessionDetail | null {
    const row = this.database.prepare(
      `SELECT s.id, s.project_id, p.name AS project_name, s.title, s.codex_thread_id,
              s.phase, s.created_at, s.updated_at
       FROM development_sessions s JOIN projects p ON p.id = s.project_id
       WHERE s.id = ?`,
    ).get(id) as unknown as SessionRow | undefined;
    if (row === undefined) return null;
    const messages = this.database.prepare(
      `SELECT id, session_id, role, content, created_at
       FROM development_messages WHERE session_id = ?
       ORDER BY created_at ASC, id ASC`,
    ).all(id) as unknown as MessageRow[];
    return { ...mapSession(row), messages: messages.map(mapMessage) };
  }

  addMessage(message: DevelopmentMessage): void {
    this.database.exec('BEGIN');
    try {
      this.database.prepare(
        `INSERT INTO development_messages (id, session_id, role, content, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(message.id, message.sessionId, message.role, message.content, message.createdAt);
      this.database.prepare('UPDATE development_sessions SET updated_at = ? WHERE id = ?')
        .run(message.createdAt, message.sessionId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  saveThreadId(id: string, threadId: string, updatedAt: string): void {
    this.database.prepare('UPDATE development_sessions SET codex_thread_id = ?, updated_at = ? WHERE id = ?')
      .run(threadId, updatedAt, id);
  }

  updateTitle(id: string, title: string, updatedAt: string): void {
    this.database.prepare('UPDATE development_sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, updatedAt, id);
  }

  updatePhase(id: string, phase: DevelopmentPhase, updatedAt: string): void {
    this.database.prepare('UPDATE development_sessions SET phase = ?, updated_at = ? WHERE id = ?')
      .run(phase, updatedAt, id);
  }
}
