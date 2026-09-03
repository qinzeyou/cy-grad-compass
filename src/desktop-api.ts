// 浏览器预览没有 Electron preload，提供不会阻塞页面渲染的最小兜底。
export function ensureDesktopApi(): void {
  if (window.desktopApi) return;

  const fallbackValues: Record<string, unknown> = {
    getProjectStatistics: { total: 0, inProgress: 0, completed: 0, archived: 0, recentProjects: [] },
    listProjects: [],
    listDevelopmentSessions: [],
    getAiConfig: { provider: 'deepseek', model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com', hasApiKey: false },
    getWechatConfig: { accountDir: '', hasDecryptKey: false, enabled: false, remarkPrefixes: [], selectedSessionIds: [], projectsRoot: '', folderTemplate: '{MM-DD}_{projectName}' },
    listWechatSessions: [],
    getWeFlowConfig: { sourcePath: '', executablePath: '', baseUrl: 'http://127.0.0.1:5031', autoStart: false, hasApiToken: false },
    listWeFlowSessions: [],
    getOrderDashboard: { candidates: [], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 } },
  };

  window.desktopApi = new Proxy({} as Window['desktopApi'], {
    get: (_target, property: string) => {
      if (property.startsWith('subscribe')) return () => () => undefined;
      if (property === 'isMaximized') return () => Promise.resolve(false);
      return () => Promise.resolve(fallbackValues[property]);
    },
  });
}
