/**
 * Anthropic Provider 适配器
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'anthropic';

export function createAnthropicAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createAnthropic({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}

export const anthropicProviderDefinition = {
  id: 'anthropic',
  configKey: 'anthropic',
  label: 'Anthropic Claude',
  defaultModel: 'claude-3-5-sonnet-20241022',
  defaultApiBase: '',
  suggestedModels: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
  ],
  apiKeyPlaceholder: 'sk-ant-...',
  create: createAnthropicAdapter,
} as const satisfies ProviderAdapterDefinition;
