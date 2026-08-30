// 中文注释：项目相关 IPC 通道。渲染进程只能通过白名单通道访问数据库与文件系统，
// 所有入参在主进程完成类型与业务校验后才进入服务层。

import { dialog, ipcMain, shell } from 'electron';
import type {
  ProjectCreateInput,
  ProjectListQuery,
  ProjectStatus,
  ProjectUpdateInput,
} from '../shared/project-types.js';
import type { ProjectService } from '../services/project-service.js';

export function registerProjectIpcHandlers(service: ProjectService): void {
  ipcMain.handle('project:get-statistics', () => service.getStatistics());

  ipcMain.handle('project:list', (_event, query: ProjectListQuery) => {
    const normalized: ProjectListQuery = { ...(query ?? {}) };
    return service.list(normalized);
  });

  ipcMain.handle('project:create', (_event, input: ProjectCreateInput) => {
    if (typeof input?.name !== 'string' || typeof input?.targetDirectory !== 'string') {
      throw new Error('缺少项目名称或目标目录');
    }
    return service.createProject({ name: input.name, targetDirectory: input.targetDirectory });
  });

  ipcMain.handle('project:update', (_event, input: ProjectUpdateInput) => {
    if (typeof input?.id !== 'string' || input.id.trim() === '') {
      throw new Error('缺少项目编号');
    }
    return service.updateProject({
      id: input.id.trim(),
      // 中文注释：name/status 均为可选，传入非法类型时交给服务层统一校验。
      name: typeof input.name === 'string' ? input.name : undefined,
      status: typeof input.status === 'string' ? (input.status as ProjectStatus) : undefined,
    });
  });

  // 中文注释：打开目录前先确认记录存在，避免数据库残留记录指向不存在的路径时静默失败。
  ipcMain.handle('project:open-path', async (_event, id: unknown) => {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new Error('缺少项目编号');
    }
    const project = service.getProject(id);
    const errorText = await shell.openPath(project.path);
    if (errorText !== '') {
      throw new Error(errorText);
    }
  });

  // 中文注释：生成项目时的目标目录选择器；用户取消时返回 null。
  ipcMain.handle('dialog:select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择项目目标目录',
      buttonLabel: '选到这里',
      properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) {
      return null;
    }
    return filePaths[0];
  });
}
