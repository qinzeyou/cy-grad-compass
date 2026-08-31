import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './app';
import logoUrl from '../assets/logo.png';

// 中文注释：复用同一张品牌图片作为页面 favicon，避免网页标签继续显示旧图标。
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = logoUrl;
document.head.appendChild(favicon);

// 中文注释：渲染进程入口只负责挂载应用组件。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
