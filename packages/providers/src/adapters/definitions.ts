/**
 * 已注册的 LLM 适配器列表（顺序即 PROVIDER_IDS / 向导展示顺序）
 */

import type { ProviderConfig } from '../config/schemas';
import { openaiProviderDefinition } from './openai';
import { anthropicProviderDefinition } from './anthropic';
import { deepseekProviderDefinition } from './deepseek';
import { openrouterProviderDefinition } from './openrouter';
import { groqProviderDefinition } from './groq';
import { zhipuProviderDefinition } from './zhipu';

export const LLM_ADAPTER_DEFINITIONS = [
  openaiProviderDefinition,
  anthropicProviderDefinition,
  openrouterProviderDefinition,
  deepseekProviderDefinition,
  groqProviderDefinition,
  zhipuProviderDefinition,
] as const;

export type ProviderId = (typeof LLM_ADAPTER_DEFINITIONS)[number]['id'];

export const PROVIDER_IDS: readonly ProviderId[] = LLM_ADAPTER_DEFINITIONS.map(d => d.id);

export type ProviderSetupOption = {
  value: ProviderId;
  label: string;
  defaultModel: string;
  defaultBase: string;
};

/** TUI 向导「选择供应商」列表（与旧 PROVIDER_OPTIONS 形状一致） */
export const PROVIDER_SETUP_OPTIONS: ProviderSetupOption[] = LLM_ADAPTER_DEFINITIONS.map(d => ({
  value: d.id,
  label: d.label,
  defaultModel: d.defaultModel,
  defaultBase: d.defaultApiBase,
}));

/** 默认模型 + apiBase，供向导合并 config */
export const PROVIDER_DEFAULTS: Record<ProviderId, { model: string; apiBase?: string }> =
  Object.fromEntries(
    LLM_ADAPTER_DEFINITIONS.map(d => [
      d.id,
      d.defaultApiBase ? { model: d.defaultModel, apiBase: d.defaultApiBase } : { model: d.defaultModel },
    ]),
  ) as Record<ProviderId, { model: string; apiBase?: string }>;

export const PROVIDER_MODELS: Record<ProviderId, string[]> = Object.fromEntries(
  LLM_ADAPTER_DEFINITIONS.map(d => [d.id, [...d.suggestedModels]]),
) as Record<ProviderId, string[]>;

export const API_KEY_PLACEHOLDERS: Record<ProviderId, string> = Object.fromEntries(
  LLM_ADAPTER_DEFINITIONS.map(d => [d.id, d.apiKeyPlaceholder]),
) as Record<ProviderId, string>;

/**
 * 已在 catalog 注册的供应商默认块（不含 google 等仅配置、无 adapter 的项）
 */
export function getDefaultRegisteredProviders(): Record<ProviderId, ProviderConfig> {
  const out = {} as Record<ProviderId, ProviderConfig>;
  for (const d of LLM_ADAPTER_DEFINITIONS) {
    const row: ProviderConfig = { apiKey: '' };
    if (d.defaultApiBase) row.apiBase = d.defaultApiBase;
    out[d.id] = row;
  }
  return out;
}
