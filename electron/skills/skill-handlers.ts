import { ipcMain } from 'electron';
import type { SkillService } from './skill-service.js';

export interface SkillIpcRegistrar { handle(channel: string, listener: (...args: unknown[]) => unknown): void; }

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`缺少${label}`);
  return value.trim();
}

export function registerSkillIpcHandlers(service: SkillService, registrar: SkillIpcRegistrar = ipcMain): void {
  registrar.handle('skill:list', () => service.list());
  registrar.handle('skill:list-features', () => service.listFeatures());
  registrar.handle('skill:get', (_event, id) => service.get(text(id, '技能编号')));
  registrar.handle('skill:get-feature', (_event, id) => service.getFeature(text(id, '功能编号')));
  registrar.handle('skill:import', (_event, sourcePath) => service.importFrom(text(sourcePath, '技能目录')));
  registrar.handle('skill:extract', (_event, input) => {
    if (!input || typeof input !== 'object') throw new Error('技能参数无效');
    const value = input as { name?: unknown; description?: unknown; instructions?: unknown };
    return service.saveExtracted({ name: text(value.name, '技能名称'), description: typeof value.description === 'string' ? value.description : undefined, instructions: text(value.instructions, '技能说明') });
  });
  registrar.handle('skill:delete', (_event, id) => service.delete(text(id, '技能编号')));
  registrar.handle('skill:delete-feature', (_event, id) => service.deleteFeature(text(id, '功能编号')));
}
