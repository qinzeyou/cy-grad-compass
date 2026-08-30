// 中文注释：模板服务。负责把用户选择的模板源目录复制到应用数据目录，
// 并保证替换失败时旧模板不受影响。本模块不依赖 Electron，便于自动化测试。

import { randomUUID } from 'node:crypto';
import { cp, mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { TemplateRepository } from '../database/template-repository.js';
import { DEFAULT_TEMPLATE_ID, type Template } from '../shared/project-types.js';

// 中文注释：校验源路径必须存在且为目录；返回原路径。
async function resolveSourceDirectory(sourcePath: string): Promise<string> {
  let info;
  try {
    info = await stat(sourcePath);
  } catch {
    throw new Error('源目录不存在，请重新选择');
  }
  if (!info.isDirectory()) {
    throw new Error('请选择目录而不是文件');
  }
  return sourcePath;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export class TemplateService {
  constructor(
    private readonly repository: TemplateRepository,
    private readonly templatesDir: string,
  ) {}

  // 中文注释：读取当前模板记录；尚未导入时返回 null。
  getTemplate(): Template | null {
    try {
      return this.repository.getDefaultTemplate();
    } catch (error) {
      console.error('读取模板记录失败', error);
      throw new Error('模板读取失败，请稍后重试');
    }
  }

  // 中文注释：首次导入模板；已存在模板时拒绝，避免误覆盖，页面应引导用户走替换流程。
  async importTemplate(sourcePath: string): Promise<Template> {
    return this.storeTemplate(sourcePath, false);
  }

  // 中文注释：替换已有模板；旧模板只有在复制并切换成功后才会被删除。
  async replaceTemplate(sourcePath: string): Promise<Template> {
    return this.storeTemplate(sourcePath, true);
  }

  /**
   * 把模板源目录安全地复制进应用数据目录：
   * 1. 先复制到临时目录；
   * 2. 复制成功后把旧模板改名为备份目录，再把临时目录切换为正式模板目录；
   * 3. 写入数据库记录；
   * 4. 数据库写入成功后才删除备份目录；任一步失败都回滚并保留旧模板。
   */
  private async storeTemplate(sourcePath: string, allowExisting: boolean): Promise<Template> {
    const source = await resolveSourceDirectory(sourcePath);
    await mkdir(this.templatesDir, { recursive: true });
    const targetDir = join(this.templatesDir, DEFAULT_TEMPLATE_ID);
    const hasExisting = await pathExists(targetDir);

    if (hasExisting && !allowExisting) {
      throw new Error('已存在代码模板，如需更换请使用“替换模板”');
    }

    // 中文注释：临时目录与备份目录都放在模板库内，与正式目录同级，
    // 保证同盘重命名（原子性）而不是跨卷复制。
    const tempDir = join(this.templatesDir, `.${DEFAULT_TEMPLATE_ID}-tmp-${randomUUID()}`);
    const backupDir = hasExisting
      ? join(this.templatesDir, `.${DEFAULT_TEMPLATE_ID}-old-${randomUUID()}`)
      : null;

    try {
      // 中文注释：完整复制成功后才会进入切换流程，复制中断时旧模板保持原样。
      await cp(source, tempDir, { recursive: true });
    } catch (error) {
      console.error('复制模板源目录失败', error);
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw new Error('模板复制失败，原模板未受影响，请重试');
    }

    try {
      if (backupDir !== null) {
        await rename(targetDir, backupDir);
      }
      await rename(tempDir, targetDir);
    } catch (error) {
      console.error('切换模板目录失败', error);
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      if (backupDir !== null && !(await pathExists(targetDir))) {
        await rename(backupDir, targetDir).catch(() => undefined);
      }
      throw new Error('模板替换失败，已保留原模板，请重试');
    }

    // 中文注释：数据库写入失败时删除刚生成的新模板并恢复旧模板，
    // 保证“旧模板只有在新模板复制成功后才切换”。
    const now = new Date().toISOString();
    const template: Template = {
      id: DEFAULT_TEMPLATE_ID,
      name: basename(source),
      storedPath: targetDir,
      createdAt: now,
      updatedAt: now,
    };
    try {
      this.repository.upsert(template);
    } catch (error) {
      console.error('写入模板记录失败', error);
      await rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
      if (backupDir !== null && !(await pathExists(targetDir))) {
        await rename(backupDir, targetDir).catch(() => undefined);
      }
      throw new Error('模板记录保存失败，已清理新模板目录，原模板已保留');
    }

    // 中文注释：新模板已切换且记录已写入，此时才删除旧模板备份。
    if (backupDir !== null) {
      await rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
    }
    return template;
  }
}
