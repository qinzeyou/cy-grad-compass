export interface WechatConfig {
  accountDir: string;
  decryptKey: string;
  enabled: boolean;
  remarkPrefixes: string[];
  selectedSessionIds: string[];
  projectsRoot: string;
  folderTemplate: string;
}

export interface WechatConfigDto {
  accountDir: string;
  hasDecryptKey: boolean;
  enabled: boolean;
  remarkPrefixes: string[];
  selectedSessionIds: string[];
  projectsRoot: string;
  folderTemplate: string;
}

export interface WechatSession {
  id: string;
  name: string;
  type: 'private' | 'group' | 'other';
  remarkName?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface WechatConnectionResult {
  ok: boolean;
  message: string;
  sessionCount?: number;
}
