import type { DatabaseSync } from 'node:sqlite';
import type { DealCandidate, MaintenanceRecord, OrderRecord, Transaction } from './order-types.js';

interface CandidateRow {
  id: string; session_id: string; session_name: string; customer_name: string; project_name: string;
  confidence: number; amount: number | null; deal_time: number | null; evidence_json: string;
  matched_folder_json: string | null; status: DealCandidate['status'];
}

interface OrderRow {
  id: string; customer_name: string; session_id: string; project_name: string; folder_path: string | null;
  confirmed_at: number; transactions_json: string; maintenance_json: string; evidence_json: string;
}

export class OrderRepository {
  constructor(private readonly database: DatabaseSync) {}

  listCandidates(limit = 50): DealCandidate[] {
    const rows = this.database.prepare('SELECT * FROM deal_candidates WHERE status = ? ORDER BY created_at DESC LIMIT ?').all('candidate', limit) as unknown as CandidateRow[];
    return rows.map((row) => ({
      id: row.id, sessionId: row.session_id, sessionName: row.session_name, customerName: row.customer_name,
      projectName: row.project_name, confidence: row.confidence, amount: row.amount, dealTime: row.deal_time,
      evidence: JSON.parse(row.evidence_json), matchedFolder: row.matched_folder_json ? JSON.parse(row.matched_folder_json) : null, status: row.status,
    }));
  }

  saveCandidate(candidate: DealCandidate): void {
    this.database.prepare(`INSERT OR REPLACE INTO deal_candidates
      (id, session_id, session_name, customer_name, project_name, confidence, amount, deal_time, evidence_json, matched_folder_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(candidate.id, candidate.sessionId, candidate.sessionName, candidate.customerName, candidate.projectName, candidate.confidence, candidate.amount,
        candidate.dealTime, JSON.stringify(candidate.evidence), candidate.matchedFolder ? JSON.stringify(candidate.matchedFolder) : null, candidate.status, new Date().toISOString());
  }

  confirmCandidate(candidateId: string, order: OrderRecord): void {
    this.database.exec('BEGIN');
    try {
      this.database.prepare('UPDATE deal_candidates SET status = ? WHERE id = ?').run('confirmed', candidateId);
      this.database.prepare(`INSERT INTO orders
        (id, customer_name, session_id, project_name, folder_path, confirmed_at, transactions_json, maintenance_json, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(order.id, order.customerName, order.sessionId, order.projectName, order.folderPath, order.confirmedAt, JSON.stringify(order.transactions), JSON.stringify(order.maintenance), JSON.stringify(order.evidence));
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  listOrders(): OrderRecord[] {
    const rows = this.database.prepare('SELECT * FROM orders ORDER BY confirmed_at DESC').all() as unknown as OrderRow[];
    return rows.map((row) => ({ id: row.id, customerName: row.customer_name, sessionId: row.session_id, projectName: row.project_name,
      folderPath: row.folder_path, confirmedAt: row.confirmed_at, transactions: JSON.parse(row.transactions_json), maintenance: JSON.parse(row.maintenance_json), evidence: JSON.parse(row.evidence_json) }));
  }

  updateOrder(order: OrderRecord): void {
    this.database.prepare(`UPDATE orders SET customer_name = ?, project_name = ?, folder_path = ?, transactions_json = ?, maintenance_json = ?, evidence_json = ? WHERE id = ?`)
      .run(order.customerName, order.projectName, order.folderPath, JSON.stringify(order.transactions), JSON.stringify(order.maintenance), JSON.stringify(order.evidence), order.id);
  }

  getOrder(id: string): OrderRecord | null {
    return this.listOrders().find((item) => item.id === id) ?? null;
  }

  addTransaction(orderId: string, transaction: Transaction): OrderRecord {
    const order = this.getOrder(orderId);
    if (!order) throw new Error('订单不存在');
    order.transactions.push(transaction);
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
