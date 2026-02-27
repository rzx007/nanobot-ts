/**
 * Provider 适配器注册
 *
 * 从配置创建各供应商的 ModelFactory 并填入注册表。
 * 新增供应商时：1) 在 adapters 下新增 xxx.ts  2) 在本文件注册
 */

import type { Config } from '@/config/schema';
import type { ModelFactory, ProviderRegistry } from '../types';
import { createOpenAIAdapter } from './openai';
import { createAnthropicAdapter } from './anthropic';
import { createDeepSeekAdapter } from './deepseek';
import { createOpenRouterAdapter } from './openrouter';
import { createGroqAdapter } from './groq';
import { logger } from '@/utils/logger';

/** 适配器列表：id -> (config) => ModelFactory | null */
const ADAPTERS: Array<{
  id: string;
  create: (config: unknown) => ModelFactory | null;
  configKey: keyof Config['providers'];
}> = [
  { id: 'openai', create: createOpenAIAdapter as (c: unknown) => ModelFactory | null, configKey: 'openai' },
  { id: 'anthropic', create: createAnthropicAdapter as (c: unknown) => ModelFactory | null, configKey: 'anthropic' },
  { id: 'deepseek', create: createDeepSeekAdapter as (c: unknown) => ModelFactory | null, configKey: 'deepseek' },
  { id: 'openrouter', create: createOpenRouterAdapter as (c: unknown) => ModelFactory | null, configKey: 'openrouter' },
  { id: 'groq', create: createGroqAdapter as (c: unknown) => ModelFactory | null, configKey: 'groq' },
];

/**
 * 根据配置创建 Provider 注册表
 * 仅当某供应商配置了 apiKey 时才会注册
 */
export function createProviderRegistry(config: Config): ProviderRegistry {
  const registry: ProviderRegistry = new Map();
  for (const { id, create, configKey } of ADAPTERS) {
    const providerConfig = config.providers[configKey];
    const factory = create(providerConfig);
    if (factory) {
      registry.set(id, factory);
      logger.info(`${id} Provider initialized`);
    }
  }
  return registry;
}

export { createOpenAIAdapter } from './openai';
export { createAnthropicAdapter } from './anthropic';
export { createDeepSeekAdapter } from './deepseek';
export { createOpenRouterAdapter } from './openrouter';
export { createGroqAdapter } from './groq';
