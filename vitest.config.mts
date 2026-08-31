import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 中文注释：渲染进程组件测试使用 vitest + jsdom。只收集 src 下的测试文件，
// 主进程逻辑测试仍由 node --test 执行，两者互不干扰。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    passWithNoTests: true,
  },
});
