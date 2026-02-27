/**
 * Groq Provider 适配器
 */

import { createGroq } from '@ai-sdk/groq';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../../config/schema';

export const PROVIDER_ID = 'groq';

export function createGroqAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createGroq({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}
