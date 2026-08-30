import { contextBridge, ipcRenderer } from 'electron';

// 中文注释：只向渲染进程暴露白名单能力，避免直接暴露 ipcRenderer 和 Node.js。
contextBridge.exposeInMainWorld('desktopApi', {
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('system:get-app-version'),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('system:open-path', path),
});
