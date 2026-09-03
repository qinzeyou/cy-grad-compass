export interface WechatMessage { id: string; sessionId: string; sessionName: string; senderName: string; senderId?: string; isSelf: boolean; text: string; sentAt: number; }
export interface ProjectFolder { name: string; path: string; year: number; datePrefix: string | null; }
export interface DealCandidate { id: string; sessionId: string; sessionName: string; customerName: string; projectName: string; confidence: number; amount: number | null; dealTime: number | null; evidence: WechatMessage[]; matchedFolder: ProjectFolder | null; status: 'candidate' | 'confirmed' | 'ignored'; userId?: string; nickname?: string; remarkName?: string; avatarUrl?: string; }
export interface Transaction { id: string; type: 'initial' | 'follow-up' | 'refund'; amount: number; occurredAt: number; note: string; evidenceMessageIds: string[]; }
export interface MaintenanceRecord { id: string; occurredAt: number; content: string; nextFollowUpAt: number | null; }
export interface OrderRecord { id: string; customerName: string; nickname?: string; remarkName?: string; avatarUrl?: string; sessionId: string; projectName: string; folderPath: string | null; confirmedAt: number; transactions: Transaction[]; maintenance: MaintenanceRecord[]; evidence: WechatMessage[]; }
export interface RevenueSummary { gross: number; refunds: number; net: number; orderCount: number; pendingCandidateCount: number; }
export interface OrderDashboard { candidates: DealCandidate[]; orders: OrderRecord[]; summary: RevenueSummary; }
