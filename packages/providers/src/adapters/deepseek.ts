/**
 * DeepSeek Provider 适配器
 */

import { createDeepSeek } from '@ai-sdk/deepseek';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'deepseek';

const DEFAULT_API_BASE = 'https://api.deepseek.com/v1';

export function createDeepSeekAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createDeepSeek({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}

export const deepseekProviderDefinition = {
  id: 'deepseek',
  configKey: 'deepseek',
  label: 'DeepSeek',
  defaultModel: 'deepseek-chat',
  defaultApiBase: DEFAULT_API_BASE,
  suggestedModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  apiKeyPlaceholder: 'sk-...',
  create: createDeepSeekAdapter,
} as const satisfies ProviderAdapterDefinition;
