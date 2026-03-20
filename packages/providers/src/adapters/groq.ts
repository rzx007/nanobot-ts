/**
 * Groq Provider 适配器
 */

import { createGroq } from '@ai-sdk/groq';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'groq';

const DEFAULT_API_BASE = 'https://api.groq.com/openai/v1';

export function createGroqAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createGroq({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}

export const groqProviderDefinition = {
  id: 'groq',
  configKey: 'groq',
  label: 'Groq',
  defaultModel: 'llama-3.3-70b-versatile',
  defaultApiBase: DEFAULT_API_BASE,
  suggestedModels: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
  ],
  apiKeyPlaceholder: 'gsk_...',
  create: createGroqAdapter,
} as const satisfies ProviderAdapterDefinition;
