/**
 * 智谱 GLM Provider 适配器（bigmodel.cn / Z.AI）
 *
 * @see https://github.com/Xiang-CH/zhipu-ai-provider
 */

import { createZhipu } from 'zhipu-ai-provider';
import type { ModelFactory } from '../types';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderAdapterDefinition } from '../catalog/types';

export const PROVIDER_ID = 'zhipu';

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';

export function createZhipuAdapter(config: ProviderConfig): ModelFactory | null {
  if (!config?.apiKey) return null;
  const baseURL = config.apiBase?.trim() || DEFAULT_BASE_URL;
  const client = createZhipu({
    apiKey: config.apiKey,
    baseURL,
    ...(config.extraHeaders && Object.keys(config.extraHeaders).length > 0
      ? { headers: config.extraHeaders }
      : {}),
  });
  return (modelName: string) => client(modelName);
}

export const zhipuProviderDefinition = {
  id: 'zhipu',
  configKey: 'zhipu',
  label: '智谱 GLM',
  defaultModel: 'glm-4.7',
  defaultApiBase: DEFAULT_BASE_URL,
  suggestedModels: ['glm-4.7', 'glm-4.7-flash', 'glm-4.6', 'glm-4.5-flash'],
  apiKeyPlaceholder: 'ZHIPU_API_KEY 或控制台密钥',
  create: createZhipuAdapter,
} as const satisfies ProviderAdapterDefinition;
