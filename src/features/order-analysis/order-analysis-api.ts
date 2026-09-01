import type { OrderDashboard, OrderRecord } from './order-types';

export const getDashboard = (): Promise<OrderDashboard> => window.desktopApi.getOrderDashboard();
export const analyze = (): Promise<OrderDashboard> => window.desktopApi.analyzeOrders();
export const confirmCandidate = (id: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null }): Promise<OrderRecord> => window.desktopApi.confirmOrderCandidate(id, input);
