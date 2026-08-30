import { app } from 'electron';
import { join } from 'node:path';

// 中文注释：数据库文件固定存放在 Electron 用户数据目录下，应用重启后数据仍然存在。
export function getDatabaseFilePath(): string {
  return join(app.getPath('userData'), 'data', 'compass.db');
}

// 中文注释：模板副本统一存放在用户数据目录的 templates 子目录下，
// 导入后即使删除源目录，模板副本仍可用于生成项目。
export function getTemplatesDirectory(): string {
  return join(app.getPath('userData'), 'templates');
}
