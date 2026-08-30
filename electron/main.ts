import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// 中文注释：ESM 环境没有内置 __dirname，这里用当前模块 URL 计算资源路径。
const currentDirectory = dirname(fileURLToPath(import.meta.url));

// 中文注释：创建桌面窗口，开发环境加载 Vite，生产环境加载构建后的静态页面。
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: join(currentDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(currentDirectory, '../dist/index.html'));
  }
}

// 中文注释：仅开放一个最小的系统能力示例，后续项目目录操作都应从这里扩展。
ipcMain.handle('system:get-app-version', () => app.getVersion());
ipcMain.handle('system:open-path', (_event, path: string) => shell.openPath(path));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
