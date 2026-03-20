/**
 * LLM 适配器定义：运行时工厂 + 向导/UI 元数据（单一来源）
 */

import type { ProviderConfig } from '../config/schemas';
import type { ModelFactory } from '../types';

export interface ProviderAdapterDefinition {
  readonly id: string;
  readonly configKey: string;
  readonly label: string;
  readonly defaultModel: string;
  /** 空字符串表示无默认 Base（如 Anthropic 官方 SDK 默认端点） */
  readonly defaultApiBase: string;
  readonly suggestedModels: readonly string[];
  readonly apiKeyPlaceholder: string;
  create(config: ProviderConfig): ModelFactory | null;
}
