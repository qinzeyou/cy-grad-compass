export type DevelopmentPhase = 'discussion' | 'development';
export type DevelopmentRole = 'user' | 'assistant';

export interface DevelopmentMessage {
  id: string;
  sessionId: string;
  role: DevelopmentRole;
  content: string;
  createdAt: string;
}

export interface DevelopmentSession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  codexThreadId: string | null;
  phase: DevelopmentPhase;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentSessionDetail extends DevelopmentSession {
  messages: DevelopmentMessage[];
}

export type DevelopmentEvent =
  | { type: 'thread-started'; threadId: string }
  | { type: 'turn-started' }
  | { type: 'assistant-message'; text: string }
  | { type: 'command-started'; id: string; command: string }
  | { type: 'command-completed'; id: string; command: string; output: string; exitCode: number | null }
  | { type: 'file-change'; paths: string[] }
  | { type: 'turn-completed' }
  | { type: 'run-error'; message: string }
  | { type: 'log'; text: string }
  | { type: 'process-exited'; exitCode: number; stopped: boolean; paused?: boolean };

export interface DevelopmentEventEnvelope {
  sessionId: string;
  event: DevelopmentEvent;
}
