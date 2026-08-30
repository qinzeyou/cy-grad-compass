import type { DatabaseSync } from 'node:sqlite';
import type {
  Project,
  ProjectListQuery,
  ProjectStatistics,
  ProjectStatus,
  RecentProject,
} from '../shared/project-types.js';

// 中文注释：数据库行结构与项目实体一一对应，列名使用 snake_case，映射到实体时转 camelCase。
interface ProjectRow {
  id: string;
  name: string;
  path: string;
  status: string;
  template_id: string;
  created_at: string;
  updated_at: string;
}

interface RecentProjectRow {
  id: string;
  name: string;
  path: string;
  status: string;
  created_at: string;
}

interface CountRow {
  count: number;
}

interface StatusCountRow {
  status: string;
  count: number;
}

function mapProjectRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    status: row.status as ProjectStatus,
    templateId: row.template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 中文注释：项目表数据访问层，只负责 SQL 与结果映射，不做业务校验。
export class ProjectRepository {
  constructor(private readonly database: DatabaseSync) {}

  // 中文注释：统计直接来自 projects 表，不维护任何手工统计副本。
  getStatistics(): ProjectStatistics {
    const totalRow = this.database
      .prepare('SELECT COUNT(*) AS count FROM projects')
      .get() as unknown as CountRow;
    const statusRows = this.database
      .prepare('SELECT status, COUNT(*) AS count FROM projects GROUP BY status')
      .all() as unknown as StatusCountRow[];
    const recentRows = this.database
      .prepare(
        `SELECT id, name, path, status, created_at
         FROM projects
         ORDER BY created_at DESC, id DESC
         LIMIT 5`,
      )
      .all() as unknown as RecentProjectRow[];

    const countByStatus = new Map(statusRows.map((row) => [row.status, Number(row.count)]));
    return {
      total: Number(totalRow.count),
      inProgress: countByStatus.get('in-progress') ?? 0,
      completed: countByStatus.get('completed') ?? 0,
      archived: countByStatus.get('archived') ?? 0,
      recentProjects: recentRows.map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status as ProjectStatus,
        path: row.path,
        createdAt: row.created_at,
      })),
    };
  }

  // 中文注释：关键字只匹配项目名称并忽略首尾空格；所有值走参数绑定，不拼接用户输入。
  list(query: ProjectListQuery): Project[] {
    const keyword = (query.keyword ?? '').trim();
    const status: ProjectStatusFilterParam = query.status === undefined ? 'all' : query.status;
    // 中文注释：转义 LIKE 通配符，把用户输入按字面量匹配，避免把 % 或 _ 当作通配符。
    const escapedKeyword = keyword.replace(/[\\%_]/g, (char) => `\\${char}`);
    const rows = this.database
      .prepare(
        `SELECT id, name, path, status, template_id, created_at, updated_at
         FROM projects
         WHERE (?1 = '' OR name LIKE ?2 ESCAPE '\\') AND (?3 = 'all' OR status = ?3)
         ORDER BY updated_at DESC, id DESC`,
      )
      .all(keyword, `%${escapedKeyword}%`, status) as unknown as ProjectRow[];
    return rows.map(mapProjectRow);
  }

  // 中文注释：修改项目状态并刷新更新时间；记录不存在时返回 null。
  updateStatus(id: string, status: ProjectStatus): Project | null {
    const now = new Date().toISOString();
    const result = this.database
      .prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now, id);
    if (Number(result.changes) === 0) {
      return null;
    }
    return this.findById(id);
  }

  // 中文注释：修改项目名称并刷新更新时间；记录不存在时返回 null。
  // 名称只改数据库记录，不移动磁盘上的项目目录。
  updateName(id: string, name: string): Project | null {
    const now = new Date().toISOString();
    const result = this.database
      .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, now, id);
    if (Number(result.changes) === 0) {
      return null;
    }
    return this.findById(id);
  }

  // 中文注释：按主键读取项目；不存在时返回 null。
  findById(id: string): Project | null {
    const row = this.database
      .prepare(
        `SELECT id, name, path, status, template_id, created_at, updated_at
         FROM projects
         WHERE id = ?`,
      )
      .get(id) as unknown as ProjectRow | undefined;
    return row === undefined ? null : mapProjectRow(row);
  }

  // 中文注释：写入项目记录，供创建流程、演示数据与自动化测试使用。
  insert(project: Project): void {
    this.database
      .prepare(
        `INSERT INTO projects (id, name, path, status, template_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.name,
        project.path,
        project.status,
        project.templateId,
        project.createdAt,
        project.updatedAt,
      );
  }
}

// 中文注释：列表查询入参中的 status 可能是 'all'，与 CHECK 约束中的状态集合区分开。
type ProjectStatusFilterParam = 'all' | ProjectStatus;
