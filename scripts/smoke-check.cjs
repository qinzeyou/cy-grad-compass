// 中文注释：临时验证脚本：创建真实窗口，验证 preload 白名单 API、统计 IPC 与数据库可用性。
// 运行方式：electron scripts/smoke-check.cjs（验证后即删除，不属于交付范围）。
// 使用 CommonJS：Electron 44 的主进程 ESM 无法从 'electron' 模块获取命名导出。
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { join } = require('node:path');
const { closeDatabase, openDatabase } = require('../dist-electron/database/connection.js');
const { getDatabaseFilePath, getTemplatesDirectory } = require('../dist-electron/database/paths.js');
const { ProjectRepository } = require('../dist-electron/database/project-repository.js');
const { TemplateRepository } = require('../dist-electron/database/template-repository.js');
const { registerProjectIpcHandlers } = require('../dist-electron/ipc/project-handlers.js');
const { registerTemplateIpcHandlers } = require('../dist-electron/ipc/template-handlers.js');
const { ProjectService } = require('../dist-electron/services/project-service.js');
const { TemplateService } = require('../dist-electron/services/template-service.js');
const { CodexController } = require('../dist-electron/development/codex-controller.js');
const { DevelopmentRepository } = require('../dist-electron/development/development-repository.js');
const { DevelopmentService } = require('../dist-electron/development/development-service.js');
const { registerDevelopmentIpcHandlers } = require('../dist-electron/development/development-handlers.js');

const projectRoot = join(__dirname, '..');

let failed = false;

function fail(message) {
  failed = true;
  console.error(`✖ ${message}`);
}

app.whenReady().then(async () => {
  try {
    Menu.setApplicationMenu(null);
    const database = openDatabase(getDatabaseFilePath());
    const projectRepository = new ProjectRepository(database);
    const templateRepository = new TemplateRepository(database);
    const service = new ProjectService(projectRepository, templateRepository);
    // 中文注释：与真实 main.ts 保持一致，补上系统处理器供页面读取应用版本。
    ipcMain.handle('system:get-app-version', () => app.getVersion());
    registerProjectIpcHandlers(service);
    registerTemplateIpcHandlers(new TemplateService(templateRepository, getTemplatesDirectory()));
    registerDevelopmentIpcHandlers(new DevelopmentService(projectRepository, new DevelopmentRepository(database), new CodexController(), () => undefined));
    ipcMain.handle('window:is-maximized', () => false);

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
      const navItems = [...document.querySelectorAll('.ant-menu-item')];
      const developmentNav = navItems.find((item) => item.textContent?.includes('项目开发'));
      developmentNav?.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        hasApi: typeof api === 'object' && api !== null,
        stats,
        listCount: list.length,
        version: await api.getAppVersion(),
        hasTemplateApi: typeof api.getTemplate === 'function' && typeof api.createProject === 'function',
        navLabels: navItems.map((item) => item.textContent?.trim()),
        hasIntegratedManagement: document.body.innerText.includes('项目管理'),
        hasAntdLayout: document.querySelector('.ant-layout') !== null,
        hasWindowBar: document.querySelector('.window-bar') !== null,
        hasWorkbench: document.querySelector('.development-workbench') !== null,
        hasNativeMenus: ['File', 'Edit', 'View'].some((label) => document.body.innerText.includes(label)),
        windowBarVisible: getComputedStyle(document.querySelector('.window-bar')).display !== 'none',
        windowBrandVisible: document.querySelector('.window-bar-brand') !== null,
        sidebarBackground: getComputedStyle(document.querySelector('.app-sidebar')).backgroundColor,
        sidebarFullHeight: document.querySelector('.app-sidebar').getBoundingClientRect().height >= window.innerHeight - 1,
        brandAlignedWithSidebar: Math.abs(document.querySelector('.window-bar-brand').getBoundingClientRect().width - document.querySelector('.app-sidebar').getBoundingClientRect().width) < 1,
        hasDevelopmentTopAction: [...document.querySelectorAll('.page-heading button')].some((button) => button.textContent?.includes('新建项目')),
        brandDividerRemoved: getComputedStyle(document.querySelector('.window-bar-brand')).borderRightWidth === '0px',
        logoRound: getComputedStyle(document.querySelector('.window-logo')).borderRadius === '50%',
        brandHasNoSubtitle: document.querySelectorAll('.window-bar-brand .ant-typography').length === 1,
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
    if (!result.navLabels.includes('项目管理')) fail('缺少项目管理菜单');
    if (result.navLabels.includes('模板管理')) fail('仍包含独立的模板管理菜单');
    if (!result.hasIntegratedManagement) fail('项目管理页未展示');
    if (!result.hasAntdLayout) fail('页面未使用 Ant Design Layout');
    if (!result.hasWindowBar) fail('缺少自定义窗口栏');
    if (!result.hasWorkbench) fail('项目开发页未展示三栏工作台');
    if (result.hasNativeMenus) fail('页面仍展示原生系统菜单文本');
    if (!result.windowBarVisible || !result.windowBrandVisible) fail('切换项目开发后窗口栏或系统标识不可见');
    if (result.sidebarBackground !== 'rgb(255, 255, 255)') fail(`侧边栏背景不是白色：${result.sidebarBackground}`);
    if (!result.sidebarFullHeight) fail('侧边栏高度未占满窗口');
    if (!result.brandAlignedWithSidebar) fail('系统标识与侧边菜单没有处于同一列');
    if (!result.hasDevelopmentTopAction) fail('项目开发页顶部操作不可见');
    if (!result.brandDividerRemoved) fail('Logo 与系统名称下方仍存在分隔线');
    if (!result.logoRound) fail('Logo 未使用圆形包裹');
    if (!result.brandHasNoSubtitle) fail('系统名称下方仍存在副标题');

    closeDatabase(database);
  } catch (error) {
    fail(`验证失败：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    app.exit(failed ? 1 : 0);
  }
});
