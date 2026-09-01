import { ipcMain } from 'electron';
import type { AppDatabase } from '../database/connection.js';
import { OrderService } from '../orders/order-service.js';

export function registerOrderIpcHandlers(database: AppDatabase, userDataPath: string): OrderService {
  const service = new OrderService(database, userDataPath);
  ipcMain.handle('order:get-dashboard', () => service.dashboard());
  ipcMain.handle('order:analyze', () => service.analyze());
  ipcMain.handle('order:confirm-candidate', (_event, candidateId: string, input: { projectName: string; customerName: string; confirmedAt: number; amount: number | null }) => service.confirmCandidate(String(candidateId), input));
  ipcMain.handle('order:add-transaction', (_event, orderId: string, input: { type: 'initial' | 'follow-up' | 'refund'; amount: number; occurredAt: number; note: string; evidenceMessageIds: string[] }) => service.addTransaction(String(orderId), input));
  ipcMain.handle('order:add-maintenance', (_event, orderId: string, input: { occurredAt: number; content: string; nextFollowUpAt: number | null }) => service.addMaintenance(String(orderId), input));
  return service;
}
