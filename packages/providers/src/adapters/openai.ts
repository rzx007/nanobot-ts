/**
 * OpenAI 兼容 Provider 适配器
 * 使用 @ai-sdk/openai，支持自定义 baseURL（兼容其他 OpenAI 兼容 API）
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'openai';

const DEFAULT_API_BASE = 'https://api.openai.com/v1';

export function createOpenAIAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createOpenAI({
    apiKey: config.apiKey,
    ...(config.apiBase && { baseURL: config.apiBase }),
  });
  return (modelName: string) => client(modelName);
}

export const openaiProviderDefinition = {
  id: 'openai',
  configKey: 'openai',
  label: 'OpenAI',
  defaultModel: 'gpt-4o',
  defaultApiBase: DEFAULT_API_BASE,
  suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  apiKeyPlaceholder: 'sk-...',
  create: createOpenAIAdapter,
} as const satisfies ProviderAdapterDefinition;
