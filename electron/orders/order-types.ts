export type DealCandidateStatus = 'candidate' | 'confirmed' | 'ignored';
export type TransactionType = 'initial' | 'follow-up' | 'refund';

export interface WechatMessage {
  id: string;
  sessionId: string;
  sessionName: string;
  senderName: string;
  senderId?: string;
  isSelf: boolean;
  text: string;
  sentAt: number;
}

export interface ProjectFolder {
  name: string;
  path: string;
  year: number;
  datePrefix: string | null;
}

export interface DealCandidate {
  id: string;
  sessionId: string;
  sessionName: string;
  customerName: string;
  projectName: string;
  confidence: number;
  amount: number | null;
  dealTime: number | null;
  evidence: WechatMessage[];
  matchedFolder: ProjectFolder | null;
  status: DealCandidateStatus;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  occurredAt: number;
  note: string;
  evidenceMessageIds: string[];
}

export interface MaintenanceRecord {
  id: string;
  occurredAt: number;
  content: string;
  nextFollowUpAt: number | null;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  sessionId: string;
  projectName: string;
  folderPath: string | null;
  confirmedAt: number;
  transactions: Transaction[];
  maintenance: MaintenanceRecord[];
  evidence: WechatMessage[];
}

export interface RevenueSummary {
  gross: number;
  refunds: number;
  net: number;
  orderCount: number;
  pendingCandidateCount: number;
}
