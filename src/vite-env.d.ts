/// <reference types="vite/client" />

interface Window {
  // 中文注释：渲染进程访问 preload 暴露的最小桌面 API。
  desktopApi: {
    getAppVersion: () => Promise<string>;
    openPath: (path: string) => Promise<string>;
  };
}
