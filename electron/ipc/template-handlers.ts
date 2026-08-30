// 中文注释：模板相关 IPC 通道。目录选择、路径校验、复制与数据库写入全部在主进程完成，
// 渲染进程无法传入任意内部存储路径，只能触发导入/替换流程并读取结果。

import { dialog, ipcMain } from 'electron';
import type { TemplateService } from '../services/template-service.js';

// 中文注释：弹出目录选择器；用户取消时返回 null，由调用方决定是否继续。
async function selectTemplateSource(): Promise<string | null> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择代码模板目录',
    buttonLabel: '导入此目录',
    properties: ['openDirectory'],
  });
  if (canceled || filePaths.length === 0) {
    return null;
  }
  return filePaths[0];
}

export function registerTemplateIpcHandlers(service: TemplateService): void {
  ipcMain.handle('template:get', () => service.getTemplate());

  ipcMain.handle('template:import', async () => {
    const source = await selectTemplateSource();
    return source === null ? null : service.importTemplate(source);
  });

  ipcMain.handle('template:replace', async () => {
    const source = await selectTemplateSource();
    return source === null ? null : service.replaceTemplate(source);
  });
}
