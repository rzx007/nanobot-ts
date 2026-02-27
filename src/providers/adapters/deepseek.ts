/**
 * DeepSeek Provider 适配器
 */

import { createDeepSeek } from '@ai-sdk/deepseek';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '@/config/schema';

export const PROVIDER_ID = 'deepseek';

export function createDeepSeekAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createDeepSeek({ apiKey: config.apiKey });
  return (modelName: string) => client(modelName);
}
