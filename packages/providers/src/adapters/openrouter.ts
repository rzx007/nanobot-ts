/**
 * OpenRouter Provider 适配器
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'openrouter';

const DEFAULT_OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

export function createOpenRouterAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createOpenRouter({
    apiKey: config.apiKey,
    baseURL: config.apiBase ?? DEFAULT_OPENROUTER_BASE,
  });
  return (modelName: string) => client(modelName);
}

export const openrouterProviderDefinition = {
  id: 'openrouter',
  configKey: 'openrouter',
  label: 'OpenRouter',
  defaultModel: 'anthropic/claude-3.5-sonnet',
  defaultApiBase: DEFAULT_OPENROUTER_BASE,
  suggestedModels: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-exp',
    'meta-llama/llama-3.3-70b-instruct',
    'deepseek/deepseek-chat',
  ],
  apiKeyPlaceholder: 'sk-or-...',
  create: createOpenRouterAdapter,
} as const satisfies ProviderAdapterDefinition;
