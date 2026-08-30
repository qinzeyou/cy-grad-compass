import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 中文注释：渲染进程使用 Vite，开发时由 Electron 加载本地开发地址。
export default defineConfig({
  plugins: [react()],
  base: './',
});
