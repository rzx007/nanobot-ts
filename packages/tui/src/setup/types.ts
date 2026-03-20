/**
 * Setup相关类型定义
 */

import type { ProviderId } from '@nanobot/providers';

export interface CheckResult {
  name: string;
  status: 'running' | 'done' | 'error';
  message?: string;
}

export type CheckSeverity = 'error' | 'warning' | 'success';

export interface SelfCheckResult {
  severity: CheckSeverity;
  errors: string[];
  warnings: string[];
  results: CheckResult[];
  canProceed: boolean;
}

/** 与 @nanobot/providers 已注册 LLM 适配器 id 一致（无独立 adapter 的供应商不在此列） */
export type ProviderType = ProviderId;

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  apiBase?: string | undefined;
  model?: string | undefined;
}

/** 渠道开关映射，键与 Config.channels 一致，由 loader.getChannelsFromConfig 生成 */
export type ChannelConfig = Record<string, { enabled: boolean }>;

export interface SetupFormData {
  provider: ProviderConfig;
  approvalEnabled: boolean;
  channels: ChannelConfig;
  workspacePath: string;
}
