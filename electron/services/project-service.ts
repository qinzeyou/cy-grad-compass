// 中文注释：项目业务层。负责输入校验、目录复制事务与业务错误兜底，
// 把数据库异常统一转换成渲染进程可读的中文错误。本模块不依赖 Electron，便于自动化测试。

import { randomUUID } from 'node:crypto';
import { cp, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectRepository } from '../database/project-repository.js';
import type { TemplateRepository } from '../database/template-repository.js';
import {
  PROJECT_STATUSES,
  PROJECT_TEMP_PREFIX,
  type Project,
  type ProjectCreateInput,
  type ProjectListQuery,
  type ProjectStatistics,
  type ProjectStatus,
  type ProjectUpdateInput,
  type ProjectUpdateResult,
} from '../shared/project-types.js';
import { assertValidProjectName } from '../shared/validation.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class ProjectService {
  constructor(
    private readonly repository: ProjectRepository,
    // 中文注释：模板仓储在创建项目时用于确认模板已导入；仅测试统计/列表的场景可以不传。
    private readonly templateRepository?: TemplateRepository,
  ) {}

  getStatistics(): ProjectStatistics {
    try {
      return this.repository.getStatistics();
    } catch (error) {
      // 中文注释：不吞掉异常，打印原始错误便于排查，同时向上抛出可读信息。
      console.error('查询项目统计失败', error);
      throw new Error('统计加载失败，请稍后重试');
    }
  }

  list(query: ProjectListQuery): Project[] {
    const status = query.status ?? 'all';
    if (status !== 'all' && !PROJECT_STATUSES.includes(status)) {
      throw new Error('非法的项目状态筛选');
    }
    try {
      return this.repository.list({ keyword: query.keyword, status });
    } catch (error) {
      console.error('查询项目列表失败', error);
      throw new Error('项目列表加载失败，请稍后重试');
    }
  }

  // 中文注释：兼容旧调用的快捷方法，只改状态；真实入口是 updateProject。
  updateStatus(id: string, status: ProjectStatus): ProjectUpdateResult {
    return this.updateProject({ id, status });
  }

  // 中文注释：更新项目名称或状态。名称只改数据库记录，不移动磁盘目录。
  updateProject(input: ProjectUpdateInput): ProjectUpdateResult {
    // 中文注释：用户输入类错误在触碰数据库前抛出，避免被下面的兜底逻辑包装成“请重试”。
    if (input.status !== undefined && !PROJECT_STATUSES.includes(input.status)) {
      throw new Error('非法的项目状态');
    }
    const newName = input.name === undefined ? undefined : assertValidProjectName(input.name);

    let project;
    try {
      project = this.repository.findById(input.id);
    } catch (error) {
      console.error('查询项目失败', error);
      throw new Error('项目查询失败，请稍后重试');
    }
    if (project === null) {
      throw new Error('项目不存在或已被删除');
    }

    try {
      if (newName !== undefined && newName !== project.name) {
        const renamed = this.repository.updateName(input.id, newName);
        if (renamed === null) {
          throw new Error('项目不存在或已被删除');
        }
        project = renamed;
      }
      if (input.status !== undefined && input.status !== project.status) {
        const updated = this.repository.updateStatus(input.id, input.status);
        if (updated === null) {
          throw new Error('项目不存在或已被删除');
        }
        project = updated;
      }
      // 中文注释：状态/名称变化后立刻返回最新统计，满足“修改成功后返回最新统计”的约定。
      return { project, statistics: this.repository.getStatistics() };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('项目不存在')) {
        throw error;
      }
      console.error('更新项目失败', error);
      throw new Error('项目更新失败，请稍后重试');
    }
  }

  // 中文注释：按 id 读取项目，供“打开目录”前校验记录是否存在。
  getProject(id: string): Project {
    let project;
    try {
      project = this.repository.findById(id);
    } catch (error) {
      console.error('查询项目失败', error);
      throw new Error('项目查询失败，请稍后重试');
    }
    if (project === null) {
      throw new Error('项目不存在或已被删除');
    }
    return project;
  }

  /**
   * 基于模板复制生成项目，遵循“临时目录 → 改名 → 写库”的事务顺序：
   * 1. 校验名称与目标目录；
   * 2. 模板目录复制到项目目录旁的临时目录；
   * 3. 复制成功后改名为最终项目目录；
   * 4. 写入项目记录，写库失败时删除刚生成的目录；
   * 5. 任一步失败都不覆盖用户已有目录。
   */
  async createProject(input: ProjectCreateInput): Promise<Project> {
    // 中文注释：名称校验规则集中在 validation 模块，这里只负责调用。
    const name = assertValidProjectName(input.name);
    const targetDirectory = input.targetDirectory.trim();

    // 中文注释：目标目录必须存在且为目录。
    let targetInfo;
    try {
      targetInfo = await stat(targetDirectory);
    } catch {
      throw new Error('目标目录不存在，请重新选择');
    }
    if (!targetInfo.isDirectory()) {
      throw new Error('目标目录不存在，请重新选择');
    }

    const projectPath = join(targetDirectory, name);
    if (await pathExists(projectPath)) {
      throw new Error('项目目录已存在，请更换项目名称或目标目录');
    }

    // 中文注释：可写性用真实创建/删除临时目录探测，比 W_OK 权限位更可靠。
    const probeDir = join(targetDirectory, `${PROJECT_TEMP_PREFIX}probe-${randomUUID()}`);
    try {
      await mkdir(probeDir);
      await rm(probeDir, { recursive: true, force: true });
    } catch {
      throw new Error('目标目录不可写，请更换目录');
    }

    // 中文注释：生成项目前必须已有模板；模板记录存在但副本目录丢失时提示重新导入。
    let template;
    try {
      template = this.templateRepository?.getDefaultTemplate() ?? null;
    } catch (error) {
      console.error('读取模板记录失败', error);
      throw new Error('模板读取失败，请稍后重试');
    }
    if (template === null) {
      throw new Error('请先导入代码模板');
    }
    if (!(await pathExists(template.storedPath))) {
      throw new Error('模板副本已损坏，请重新导入模板');
    }

    // 中文注释：临时目录与最终目录同盘（都在用户选的目标目录下），改名是原子操作。
    const tempDir = join(targetDirectory, `${PROJECT_TEMP_PREFIX}${name}-${randomUUID()}`);
    try {
      await cp(template.storedPath, tempDir, { recursive: true });
      await rename(tempDir, projectPath);
    } catch (error) {
      console.error('复制模板生成项目失败', error);
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw new Error('项目生成失败，未覆盖任何已有目录，请重试');
    }

    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name,
      path: projectPath,
      status: 'in-progress',
      templateId: template.id,
      createdAt: now,
      updatedAt: now,
    };
    try {
      this.repository.insert(project);
    } catch (error) {
      console.error('写入项目记录失败', error);
      // 中文注释：记录未保存就不留半成品目录，避免用户以为项目已生成。
      await rm(projectPath, { recursive: true, force: true }).catch(() => undefined);
      throw new Error('项目记录保存失败，已清理生成的目录，请重试');
    }
    return project;
  }
}
