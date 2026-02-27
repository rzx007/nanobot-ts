/**
 * LLM Provider 类型定义
 *
 * 统一接口便于扩展新供应商，各适配器实现 IModelFactory 即可接入。
 */

import type { LanguageModel } from 'ai';

/**
 * 模型工厂：根据模型名返回 AI SDK 的 LanguageModel
 * 每个供应商适配器实现此接口，由 registry 按 provider 名调用
 */
export type ModelFactory = (modelName: string) => LanguageModel;

/**
 * Provider 注册表：provider 名称 -> 模型工厂
 * 新增供应商时在 adapters 中注册即可
 */
export type ProviderRegistry = Map<string, ModelFactory>;

/**
 * 支持的 Provider 名称（与 parseModelString 的 provider 及配置 key 一致）
 */
export const PROVIDER_IDS = [
  'openai',
  'anthropic',
  'deepseek',
  'openrouter',
  'groq',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
