import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { join } from 'node:path';
import { closeDatabase, openDatabase, type AppDatabase } from './database/connection.js';
import { getDatabaseFilePath, getTemplatesDirectory } from './database/paths.js';
import { ProjectRepository } from './database/project-repository.js';
import { TemplateRepository } from './database/template-repository.js';
import { registerProjectIpcHandlers } from './ipc/project-handlers.js';
import { registerTemplateIpcHandlers } from './ipc/template-handlers.js';
import { registerAiIpcHandlers } from './ipc/ai-handlers.js';
import { ProjectService } from './services/project-service.js';
import { TemplateService } from './services/template-service.js';
import { CodexController } from './development/codex-controller.js';
import { DevelopmentRepository } from './development/development-repository.js';
import { DevelopmentService } from './development/development-service.js';
import { registerDevelopmentIpcHandlers, sendDevelopmentEvent } from './development/development-handlers.js';

// 中文注释：主进程编译为 CommonJS（Electron 44 的 ESM 无法从 'electron' 模块获取命名导出），
// CommonJS 环境直接使用 __dirname 定位资源目录。
const currentDirectory = __dirname;

// 中文注释：主进程持有数据库连接，窗口与 IPC 处理器共享同一数据源，退出前统一关闭。
let database: AppDatabase | null = null;
let developmentService: DevelopmentService | null = null;
let mainWindow: BrowserWindow | null = null;
let shutdownStarted = false;

// 中文注释：创建桌面窗口，开发环境加载 Vite，生产环境加载构建后的静态页面。
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#F5F7FA',
    show: false,
    webPreferences: {
      // 中文注释：preload 编译为 CommonJS 产物，保证沙箱渲染进程中可以正常加载。
      preload: join(currentDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow = window;
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { if (mainWindow === window) mainWindow = null; });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(join(currentDirectory, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // 中文注释：无边框窗口使用自定义窗口栏，关闭 Electron 默认 File/Edit/View 菜单。
  Menu.setApplicationMenu(null);
  // 中文注释：数据库在应用就绪后打开，userData 路径此时才可用。
  database = openDatabase(getDatabaseFilePath());
  const templatesDir = getTemplatesDirectory();

  // 中文注释：仓储与服务的依赖在主进程组装一次，窗口与 IPC 处理器共享同一实例。
  const projectRepository = new ProjectRepository(database);
  const templateRepository = new TemplateRepository(database);
  const projectService = new ProjectService(projectRepository, templateRepository);
  const templateService = new TemplateService(templateRepository, templatesDir);
  const developmentRepository = new DevelopmentRepository(database);
  const codexController = new CodexController();
  developmentService = new DevelopmentService(
    projectRepository,
    developmentRepository,
    codexController,
    (sessionId, event) => sendDevelopmentEvent(mainWindow?.webContents ?? null, sessionId, event),
  );

  registerProjectIpcHandlers(projectService);
  registerTemplateIpcHandlers(templateService);
  registerDevelopmentIpcHandlers(developmentService);
  // 中文注释：AI 配置读写与连通性测试独立于项目数据库，配置放在 userData 根目录。
  registerAiIpcHandlers({ getUserDataPath: () => app.getPath('userData') });

  // 中文注释：仅开放最小系统能力，模板与项目操作都走各自专用通道。
  ipcMain.handle('system:get-app-version', () => app.getVersion());
  ipcMain.handle('system:open-path', (_event, path: string) => shell.openPath(path));
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:toggle-maximize', () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); return mainWindow?.isMaximized() ?? false; });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (shutdownStarted || developmentService === null) return;
  event.preventDefault();
  shutdownStarted = true;
  void developmentService.dispose().finally(() => {
    if (database !== null) {
      closeDatabase(database);
      database = null;
    }
    app.quit();
  });
});
