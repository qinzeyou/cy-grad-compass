import type { DatabaseSync } from 'node:sqlite';
import type { DealCandidate, MaintenanceRecord, OrderRecord, Transaction } from './order-types.js';

interface CandidateRow {
  id: string; session_id: string; session_name: string; customer_name: string; project_name: string;
  confidence: number; amount: number | null; deal_time: number | null; evidence_json: string;
  matched_folder_json: string | null; status: DealCandidate['status']; ignored_at?: number | null;
  user_id?: string | null; nickname?: string | null; remark_name?: string | null; avatar_url?: string | null;
}

interface OrderRow {
  id: string; customer_name: string; session_id: string; project_name: string; folder_path: string | null;
  confirmed_at: number; transactions_json: string; maintenance_json: string; evidence_json: string; nickname?: string | null; remark_name?: string | null; avatar_url?: string | null;
}

export class OrderRepository {
  constructor(private readonly database: DatabaseSync) {}

  listCandidates(limit = 50): DealCandidate[] {
    const rows = this.database.prepare('SELECT * FROM deal_candidates WHERE status = ? ORDER BY deal_time DESC, created_at DESC LIMIT ?').all('candidate', limit) as unknown as CandidateRow[];
    return rows.map((row) => ({
      id: row.id, sessionId: row.session_id, sessionName: row.session_name, customerName: row.customer_name,
      projectName: row.project_name, confidence: row.confidence, amount: row.amount, dealTime: row.deal_time,
      evidence: JSON.parse(row.evidence_json), matchedFolder: row.matched_folder_json ? JSON.parse(row.matched_folder_json) : null, status: row.status,
      userId: row.user_id || undefined, nickname: row.nickname || undefined, remarkName: row.remark_name || undefined, avatarUrl: row.avatar_url || undefined,
    }));
  }

  saveCandidate(candidate: DealCandidate): void {
    this.database.prepare(`INSERT OR REPLACE INTO deal_candidates
      (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at, user_id, nickname, remark_name, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(candidate.id, candidate.sessionId, candidate.sessionName, candidate.customerName, candidate.projectName, candidate.confidence, candidate.amount,
        candidate.dealTime, JSON.stringify(candidate.evidence), candidate.matchedFolder ? JSON.stringify(candidate.matchedFolder) : null, candidate.status, new Date().toISOString(), candidate.userId || null, candidate.nickname || null, candidate.remarkName || null, candidate.avatarUrl || null);
  }

  deleteCandidate(id: string): boolean {
    return this.database.prepare('DELETE FROM deal_candidates WHERE id = ?').run(id).changes > 0;
  }

  ignoreCandidate(id: string, ignoredAt: number): boolean {
    return this.database.prepare('UPDATE deal_candidates SET status = ?, ignored_at = ? WHERE id = ? AND status = ?').run('ignored', ignoredAt, id, 'candidate').changes > 0;
  }

  findLatestIgnoredAt(sessionId: string): number | null {
    const row = this.database.prepare('SELECT MAX(ignored_at) AS ignored_at FROM deal_candidates WHERE session_id = ? AND status = ?').get(sessionId, 'ignored') as { ignored_at?: number | null } | undefined;
    return row?.ignored_at == null ? null : Number(row.ignored_at);
  }

  confirmCandidate(candidateId: string, order: OrderRecord): OrderRecord {
    this.database.exec('BEGIN');
    try {
      this.database.prepare('UPDATE deal_candidates SET status = ? WHERE id = ?').run('confirmed', candidateId);
      const existing = this.listOrders().find((item) => item.sessionId === order.sessionId);
      if (existing) {
        const evidence = [...new Map([...existing.evidence, ...order.evidence].map((item) => [item.id, item])).values()].sort((a, b) => a.sentAt - b.sentAt);
        const merged: OrderRecord = { ...existing, customerName: order.customerName, nickname: order.nickname || existing.nickname, remarkName: order.remarkName || existing.remarkName,
          avatarUrl: order.avatarUrl || existing.avatarUrl, projectName: order.projectName, folderPath: existing.folderPath || order.folderPath,
          confirmedAt: Math.max(existing.confirmedAt, order.confirmedAt), transactions: [...existing.transactions, ...order.transactions].sort((a, b) => a.occurredAt - b.occurredAt), evidence };
        this.updateOrder(merged);
        this.database.exec('COMMIT');
        return merged;
      }
      this.database.prepare(`INSERT INTO orders
        (id, customer_name, nickname, remark_name, avatar_url, session_id, project_name, folder_path, confirmed_at, transactions_json, maintenance_json, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(order.id, order.customerName, order.nickname || null, order.remarkName || null, order.avatarUrl || null, order.sessionId, order.projectName, order.folderPath, order.confirmedAt, JSON.stringify(order.transactions), JSON.stringify(order.maintenance), JSON.stringify(order.evidence));
      this.database.exec('COMMIT');
      return order;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  listOrders(): OrderRecord[] {
    const rows = this.database.prepare('SELECT * FROM orders ORDER BY confirmed_at DESC').all() as unknown as OrderRow[];
    return rows.map((row) => ({ id: row.id, customerName: row.customer_name, nickname: row.nickname || undefined, remarkName: row.remark_name || undefined, avatarUrl: row.avatar_url || undefined, sessionId: row.session_id, projectName: row.project_name,
      folderPath: row.folder_path, confirmedAt: row.confirmed_at, transactions: JSON.parse(row.transactions_json), maintenance: JSON.parse(row.maintenance_json), evidence: JSON.parse(row.evidence_json) }));
  }

  updateOrder(order: OrderRecord): void {
    this.database.prepare(`UPDATE orders SET customer_name = ?, nickname = ?, remark_name = ?, avatar_url = ?, project_name = ?, folder_path = ?, confirmed_at = ?, transactions_json = ?, maintenance_json = ?, evidence_json = ? WHERE id = ?`)
      .run(order.customerName, order.nickname || null, order.remarkName || null, order.avatarUrl || null, order.projectName, order.folderPath, order.confirmedAt, JSON.stringify(order.transactions), JSON.stringify(order.maintenance), JSON.stringify(order.evidence), order.id);
  }

  getOrder(id: string): OrderRecord | null {
    return this.listOrders().find((item) => item.id === id) ?? null;
  }

  deleteOrder(id: string): boolean {
    return this.database.prepare('DELETE FROM orders WHERE id = ?').run(id).changes > 0;
  }

  addTransaction(orderId: string, transaction: Transaction): OrderRecord {
    const order = this.getOrder(orderId);
    if (!order) throw new Error('订单不存在');
    order.transactions.push(transaction);
    order.confirmedAt = Math.max(order.confirmedAt, transaction.occurredAt);
    this.updateOrder(order);
    return order;
  }

  addMaintenance(orderId: string, maintenance: MaintenanceRecord): OrderRecord {
    const order = this.getOrder(orderId);
    if (!order) throw new Error('订单不存在');
    order.maintenance.push(maintenance);
    this.updateOrder(order);
    return order;
  }
}
