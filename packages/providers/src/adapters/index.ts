/**
 * Provider 适配器注册
 *
 * 从配置创建各供应商的 ModelFactory 并填入注册表。
 * 新增供应商：在 adapters/<name>.ts 增加 definition 并加入 definitions.ts 列表。
 */

import type { Config } from '@nanobot/shared';
import type { ProviderConfig } from '../config/schemas';
import type { ProviderRegistry } from '../types';
import { LLM_ADAPTER_DEFINITIONS } from './definitions';
import { logger } from '@nanobot/logger';

/**
 * 根据配置创建 Provider 注册表
 * 仅当某供应商配置了 apiKey 时才会注册
 */
export function createProviderRegistry(config: Config): ProviderRegistry {
  const registry: ProviderRegistry = new Map();
  const providers = config.providers as Record<string, ProviderConfig | undefined>;
  for (const def of LLM_ADAPTER_DEFINITIONS) {
    const providerConfig = providers[def.configKey];
    const factory = def.create(providerConfig ?? { apiKey: '' });
    if (factory) {
      registry.set(def.id, factory);
      logger.info(`${def.id} Provider initialized`);
    }
  }
  return registry;
}

export { LLM_ADAPTER_DEFINITIONS } from './definitions';
export type { ProviderId, ProviderSetupOption } from './definitions';
export {
  PROVIDER_IDS,
  PROVIDER_SETUP_OPTIONS,
  PROVIDER_DEFAULTS,
  PROVIDER_MODELS,
  API_KEY_PLACEHOLDERS,
  getDefaultRegisteredProviders,
} from './definitions';

export { createOpenAIAdapter } from './openai';
export { createAnthropicAdapter } from './anthropic';
export { createDeepSeekAdapter } from './deepseek';
export { createOpenRouterAdapter } from './openrouter';
export { createGroqAdapter } from './groq';
export { createZhipuAdapter } from './zhipu';
