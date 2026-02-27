/**
 * Anthropic Provider 适配器
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../../config/schema';

export const PROVIDER_ID = 'anthropic';

export function createAnthropicAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createAnthropic({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}
