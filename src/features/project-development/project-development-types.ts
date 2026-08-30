export type ChatRole = 'user' | 'assistant';
export type RunStatus = 'idle' | 'queued' | 'running' | 'completed' | 'stopped';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type DevelopmentRun = {
  status: RunStatus;
  progress: number;
  currentAction: string;
  logs: string[];
};

export type DevelopmentSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
  run: DevelopmentRun;
};
