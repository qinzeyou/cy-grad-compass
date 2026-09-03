// 中文注释：应用外壳渲染测试。验证侧边菜单出现“设置”项，点击后能切换到
// AI 设置页，且仪表盘等既有入口仍保留。
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { ensureDesktopApi } from './desktop-api';
import { installDesktopApiMock } from './test/desktop-api-mock';

describe('应用外壳', () => {
  it('浏览器环境自动安装桌面 API 兜底', async () => {
    Object.defineProperty(window, 'desktopApi', { configurable: true, writable: true, value: undefined });
    ensureDesktopApi();

    expect(await window.desktopApi.isMaximized()).toBe(false);
    expect(await window.desktopApi.listDevelopmentSessions()).toEqual([]);
    expect(await window.desktopApi.listProjects({})).toEqual([]);
    expect(window.desktopApi.subscribeOrderChanges(() => undefined)).toBeTypeOf('function');
  });

  it('没有 Electron desktopApi 时仍能渲染浏览器页面', async () => {
    Object.defineProperty(window, 'desktopApi', { configurable: true, writable: true, value: undefined });
    render(<App />);

    expect(await screen.findByText('仪表盘内容已移除，请从「项目管理」查看项目进度。')).toBeTruthy();
  });

  it('侧边菜单包含仪表盘、项目管理、项目开发与设置', async () => {
    installDesktopApiMock();
    render(<App />);
    const labels = (await screen.findAllByRole('menuitem')).map((item) => item.textContent?.trim());
    expect(labels).toContain('仪表盘');
    expect(labels).toContain('项目管理');
    expect(labels).toContain('项目开发');
    expect(labels).toContain('设置');
  });

  it('点击设置菜单可打开 AI 设置页', async () => {
    installDesktopApiMock();
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /设置/ }));
    expect(await screen.findByText('AI 服务')).toBeTruthy();
    expect(screen.getByRole('button', { name: /保存配置/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /测试连接/ })).toBeTruthy();
  });

  it('设置页侧边栏显示设置菜单并支持返回主菜单', async () => {
    installDesktopApiMock();
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /设置/ }));

    expect(screen.getByRole('button', { name: /返回/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /AI 服务/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /微信数据源/ })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /仪表盘/ })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /微信数据源/ }));
    expect(await screen.findByText('当前项目直接读取微信数据库并监听新消息，不需要启动其他项目。')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /返回/ }));
    expect(screen.getByRole('menuitem', { name: /仪表盘/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /返回/ })).toBeNull();
  });

  it('设置内容区使用居中布局容器', async () => {
    installDesktopApiMock();
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /设置/ }));
    expect(document.querySelector('.settings-layout')?.classList.contains('settings-layout-centered')).toBe(true);
  });

  it('切换页面后保留正在后台执行的成单分析', async () => {
    let finishAnalyze!: () => void;
    const pendingAnalyze = new Promise<Awaited<ReturnType<Window['desktopApi']['analyzeOrders']>>>((resolve) => {
      finishAnalyze = () => resolve({ candidates: [], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 } });
    });
    const api = installDesktopApiMock({ analyzeOrders: vi.fn(() => pendingAnalyze) });
    render(<App />);

    fireEvent.click(await screen.findByRole('menuitem', { name: /成单分析/ }));
    fireEvent.click(await screen.findByRole('button', { name: '分析新消息' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /项目管理/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /成单分析/ }));

    expect(screen.getByRole('button', { name: /分析新消息/ }).classList.contains('ant-btn-loading')).toBe(true);
    expect(api.analyzeOrders).toHaveBeenCalledTimes(1);

    finishAnalyze();
    await waitFor(() => expect(screen.getByRole('button', { name: /分析新消息/ }).classList.contains('ant-btn-loading')).toBe(false));
  });

  it('成单详情使用弹窗并支持确认未成单', async () => {
    const candidate = { id: 'c1', sessionId: 's1', sessionName: '客户', customerName: '客户', nickname: '微信名称', avatarUrl: '/avatar.png', projectName: '项目', confidence: 0.9, amount: 800, dealTime: 1, evidence: [{ id: 'm1', sessionId: 's1', sessionName: '客户', senderName: '客户', isSelf: false, sentAt: 1, text: '成交证据' }], matchedFolder: null, status: 'candidate' as const };
    const api = installDesktopApiMock({ getOrderDashboard: vi.fn(async () => ({ candidates: [candidate], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 1 } })) });
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /成单分析/ }));
    fireEvent.click(await screen.findByRole('button', { name: '查看成单线索：微信名称 · 项目' }));
    expect(document.querySelector('.ant-drawer')).toBeNull();
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(within(await screen.findByRole('dialog')).getByText('微信名称')).toBeTruthy();
    expect(screen.queryByText('s1')).toBeNull();
    expect(screen.queryByText('成交证据')).toBeNull();
    fireEvent.click(screen.getByText('成单聊天记录（1 条）'));
    expect(await screen.findByText('成交证据')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '确认未成单' }));
    await screen.findAllByText('确认未成单？');
    fireEvent.click(screen.getAllByRole('button', { name: '确认未成单' })[1]);
    await waitFor(() => expect(api.ignoreOrderCandidate).toHaveBeenCalledWith('c1'));
  });

  it('待确认成单可在弹窗中删除', async () => {
    const candidate = { id: 'c1', sessionId: 's1', sessionName: '客户', customerName: '客户', projectName: '项目', confidence: 0.9, amount: 800, dealTime: 1, evidence: [], matchedFolder: null, status: 'candidate' as const };
    const api = installDesktopApiMock({ getOrderDashboard: vi.fn(async () => ({ candidates: [candidate], orders: [], summary: { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 1 } })) });
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /成单分析/ }));
    fireEvent.click(await screen.findByRole('button', { name: '查看成单线索：客户 · 项目' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /删\s*除/ }));
    await screen.findAllByText('删除待确认线索？');
    fireEvent.click(within(screen.getAllByRole('dialog').at(-1)!).getByRole('button', { name: /删\s*除/ }));
    await waitFor(() => expect(api.deleteOrderCandidate).toHaveBeenCalledWith('c1'));
  });

  it('订单台账使用表格内容区滚动', async () => {
    const order = { id: 'o1', sessionId: 's1', customerName: 'wxid-user', nickname: '微信名称', remarkName: '鱼02-28_美妆预约', avatarUrl: '/avatar.png', projectName: '项目', folderPath: null, confirmedAt: 1, transactions: [{ id: 't1', type: 'initial' as const, amount: 800, occurredAt: 1, note: '', evidenceMessageIds: [] }], maintenance: [], evidence: [] };
    installDesktopApiMock({ getOrderDashboard: vi.fn(async () => ({ candidates: [], orders: [order], summary: { gross: 800, refunds: 0, net: 800, orderCount: 1, pendingCandidateCount: 0 } })) });
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /成单分析/ }));
    await screen.findByText('订单台账');
    expect(screen.getByText('鱼02-28_美妆预约')).toBeTruthy();
    expect(screen.getByText('昵称：微信名称')).toBeTruthy();
    expect(screen.queryByText('wxid-user')).toBeNull();
    expect(document.querySelector('.order-table-card .ant-avatar img')?.getAttribute('src')).toBe('/avatar.png');
    await waitFor(() => expect(document.querySelector('.order-table-card .ant-table-body')).toBeTruthy());
  });

  it('订单台账按接口返回的客户订单顺序展示', async () => {
    const orders = [
      { id: 'o2', sessionId: 's1', customerName: '客户', nickname: '客户', projectName: '新交易', folderPath: null, confirmedAt: 200, transactions: [{ id: 't2', type: 'initial' as const, amount: 300, occurredAt: 200, note: '', evidenceMessageIds: [] }], maintenance: [], evidence: [] },
      { id: 'o1', sessionId: 's2', customerName: '客户2', nickname: '客户2', projectName: '旧交易', folderPath: null, confirmedAt: 100, transactions: [{ id: 't1', type: 'initial' as const, amount: 500, occurredAt: 100, note: '', evidenceMessageIds: [] }], maintenance: [], evidence: [] },
    ];
    installDesktopApiMock({ getOrderDashboard: vi.fn(async () => ({ candidates: [], orders, summary: { gross: 800, refunds: 0, net: 800, orderCount: 2, pendingCandidateCount: 0 } })) });
    render(<App />);
    fireEvent.click(await screen.findByRole('menuitem', { name: /成单分析/ }));
    await screen.findByText('订单台账');
    const cells = Array.from(document.querySelectorAll('.order-table-card .ant-table-tbody tr td:first-child')).map((item) => item.textContent?.trim());
    expect(cells[0]).toContain('客户');
    expect(cells[1]).toContain('客户2');
  });
});
