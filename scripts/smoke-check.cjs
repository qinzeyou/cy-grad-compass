// 中文注释：临时验证脚本：创建真实窗口，验证 preload 白名单 API、统计 IPC 与数据库可用性。
// 运行方式：electron scripts/smoke-check.cjs（验证后即删除，不属于交付范围）。
// 使用 CommonJS：Electron 44 的主进程 ESM 无法从 'electron' 模块获取命名导出。
const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('node:path');
const { closeDatabase, openDatabase } = require('../dist-electron/database/connection.js');
const { getDatabaseFilePath } = require('../dist-electron/database/paths.js');
const { ProjectRepository } = require('../dist-electron/database/project-repository.js');
const { registerProjectIpcHandlers } = require('../dist-electron/ipc/project-handlers.js');
const { ProjectService } = require('../dist-electron/services/project-service.js');

const projectRoot = join(__dirname, '..');

let failed = false;

function fail(message) {
  failed = true;
  console.error(`✖ ${message}`);
}

app.whenReady().then(async () => {
  try {
    const database = openDatabase(getDatabaseFilePath());
    const service = new ProjectService(new ProjectRepository(database));
    // 中文注释：与真实 main.ts 保持一致，补上系统处理器供页面读取应用版本。
    ipcMain.handle('system:get-app-version', () => app.getVersion());
    registerProjectIpcHandlers(service);

    const window = new BrowserWindow({
      width: 1100,
      height: 720,
      show: false,
      webPreferences: {
        preload: join(projectRoot, 'dist-electron', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    await window.loadFile(join(projectRoot, 'dist', 'index.html'));

    const result = await window.webContents.executeJavaScript(`(async () => {
      const api = window.desktopApi;
      const stats = await api.getProjectStatistics();
      const list = await api.listProjects({});
      return {
        hasApi: typeof api === 'object' && api !== null,
        stats,
        listCount: list.length,
        version: await api.getAppVersion(),
        hasTemplateApi: typeof api.getTemplate === 'function' && typeof api.createProject === 'function',
      };
    })()`);

    if (!result.hasApi) {
      fail('window.desktopApi 未暴露');
    } else {
      console.log(`✔ desktopApi 已暴露，应用版本 ${result.version}，模板/创建接口可用：${result.hasTemplateApi}`);
    }
    if (typeof result.stats?.total !== 'number') {
      fail('getProjectStatistics 返回结构异常');
    } else {
      console.log(`✔ 统计 IPC 正常，项目总数 ${result.stats.total}，项目列表 ${result.listCount} 条`);
    }

    closeDatabase(database);
  } catch (error) {
    fail(`验证失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    app.quit();
  }
});
