import type { WechatMessage } from '../orders/order-types.js';
import type { WechatSession } from '../wechat/wechat-types.js';

export interface WeFlowConfig {
  sourcePath: string;
  executablePath: string;
  baseUrl: string;
  apiToken: string;
  autoStart: boolean;
}

export interface WeFlowConfigDto { sourcePath: string; executablePath: string; baseUrl: string; autoStart: boolean; hasApiToken: boolean; }
export interface WeFlowConnectionResult { ok: boolean; message: string; sessionCount?: number; }

export interface WeFlowBridgeDeps {
  fetch(input: string, init?: RequestInit): Promise<Response>;
  spawn(executablePath: string): { unref(): void };
  wait(ms: number): Promise<void>;
}

export type { WechatMessage, WechatSession };
