import type { OrderDashboard, OrderRecord } from './order-types';

export const getDashboard = (): Promise<OrderDashboard> => window.desktopApi.getOrderDashboard();
export const analyze = (range?: { beginTimestamp?: number; endTimestamp?: number }): Promise<OrderDashboard> => window.desktopApi.analyzeOrders(range);
export const confirmCandidate = (id: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null; folderMode?: 'new' | 'existing' | 'none'; folderPath?: string | null }): Promise<OrderRecord> => window.desktopApi.confirmOrderCandidate(id, input);
export const ignoreCandidate = (id: string): Promise<void> => window.desktopApi.ignoreOrderCandidate(id);
export const deleteCandidate = (id: string): Promise<void> => window.desktopApi.deleteOrderCandidate(id);
export const deleteOrder = (id: string): Promise<void> => window.desktopApi.deleteOrder(id);
