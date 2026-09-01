import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFolderName } from './order-utils.js';
import type { ProjectFolder } from './order-types.js';

export async function scanProjectFolders(root: string): Promise<ProjectFolder[]> {
  const years = await readdir(root, { withFileTypes: true });
  const folders: ProjectFolder[] = [];
  for (const yearEntry of years) {
    if (!yearEntry.isDirectory() || !/^\d{4}$/.test(yearEntry.name)) continue;
    const year = Number(yearEntry.name);
    const projects = await readdir(join(root, yearEntry.name), { withFileTypes: true });
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      folders.push({ ...parseFolderName(project.name, year), path: join(root, yearEntry.name, project.name) });
    }
  }
  return folders.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}
