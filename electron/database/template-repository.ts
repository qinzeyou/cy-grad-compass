import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_TEMPLATE_ID, type Template } from '../shared/project-types.js';

// 中文注释：模板表行结构与模板实体一一对应，列名 snake_case，映射时转 camelCase。
interface TemplateRow {
  id: string;
  name: string;
  stored_path: string;
  created_at: string;
  updated_at: string;
}

function mapTemplateRow(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    storedPath: row.stored_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 中文注释：模板表数据访问层，只负责 SQL 与结果映射。
// 首版只有一个模板来源（固定 id），因此不提供按名称或任意 id 查询的通用方法。
export class TemplateRepository {
  constructor(private readonly database: DatabaseSync) {}

  // 中文注释：读取默认模板记录；尚未导入时返回 null。
  getDefaultTemplate(): Template | null {
    const row = this.database
      .prepare(
        `SELECT id, name, stored_path, created_at, updated_at
         FROM templates
         WHERE id = ?`,
      )
      .get(DEFAULT_TEMPLATE_ID) as unknown as TemplateRow | undefined;
    return row === undefined ? null : mapTemplateRow(row);
  }

  // 中文注释：写入或更新默认模板记录。导入与替换都走这里，替换不产生新行。
  upsert(template: Template): Template {
    this.database
      .prepare(
        `INSERT INTO templates (id, name, stored_path, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           stored_path = excluded.stored_path,
           updated_at = excluded.updated_at`,
      )
      .run(
        template.id,
        template.name,
        template.storedPath,
        template.createdAt,
        template.updatedAt,
      );
    return template;
  }
}
