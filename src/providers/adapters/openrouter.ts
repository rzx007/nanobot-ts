/**
 * OpenRouter Provider 适配器
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../../config/schema';

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
