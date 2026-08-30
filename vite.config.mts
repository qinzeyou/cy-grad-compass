import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 中文注释：渲染进程使用 Vite，开发时由 Electron 加载本地开发地址。
// 包级不再声明 "type": "module"（主进程编译为 CommonJS），
// Vite 会把本配置按 CommonJS 转译加载，功能不受影响。
export default defineConfig({
  plugins: [react()],
  base: './',
});
