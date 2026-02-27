/**
 * OpenAI 兼容 Provider 适配器
 * 使用 @ai-sdk/openai，支持自定义 baseURL（兼容其他 OpenAI 兼容 API）
 */

import { createOpenAI } from '@ai-sdk/openai';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../../config/schema';

export const PROVIDER_ID = 'openai';

export function createOpenAIAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const client = createOpenAI({
    apiKey: config.apiKey,
    ...(config.apiBase && { baseURL: config.apiBase }),
  });
  return (modelName: string) => client(modelName);
}
