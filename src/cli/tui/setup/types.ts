/**
 * Setup相关类型定义
 */

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

export type ProviderType = 'openai' | 'anthropic' | 'openrouter' | 'deepseek' | 'groq' | 'google';

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  apiBase?: string | undefined;
  model?: string | undefined;
}

export interface ChannelConfig {
  whatsapp: {
    enabled: boolean;
  };
  feishu: {
    enabled: boolean;
  };
  email: {
    enabled: boolean;
  };
}

export interface SetupFormData {
  provider: ProviderConfig;
  approvalEnabled: boolean;
  channels: ChannelConfig;
  workspacePath: string;
}
