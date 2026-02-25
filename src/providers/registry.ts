/**
 * LLM Provider 实现
 *
 * 使用 Vercel AI SDK 的 generateText 实现 LLM 提供商接口
 * 参考: https://sdk.vercel.ai/docs/ai-sdk-core/generating-text
 */

import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LLMResponse, ToolCall, ToolSet } from '../bus/events';
import type { Config } from '../config/schema';
import { parseModelString } from '../utils/helpers';
import { logger } from '../utils/logger';
import { ProviderError } from '../utils/errors';

/**
 * 将 agent 的 messages 转换为 AI SDK ModelMessage 格式
 * agent 的 tool 消息可能是 { role:'tool', content: string } 或 { role:'tool', content: ToolResultPart[] }
 */
function normalizeMessages(
  messages: Array<{ role: string; content: unknown; timestamp?: string }>
): ModelMessage[] {
  return messages.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'system' as const, content: String(msg.content) };
    }
    if (msg.role === 'user') {
      return { role: 'user' as const, content: String(msg.content) };
    }
    if (msg.role === 'assistant') {
      return { role: 'assistant' as const, content: String(msg.content) };
    }
    if (msg.role === 'tool') {
      const content = msg.content;
      if (Array.isArray(content) && content.length > 0) {
        return { role: 'tool' as const, content };
      }
      return {
        role: 'tool' as const,
        content: [{ type: 'tool-result' as const, toolCallId: '', toolName: '', output: content }],
      };
    }
    return msg as ModelMessage;
  });
}

/**
 * LLM Provider
 *
 * 统一的 LLM 提供商接口实现，使用 AI SDK generateText
 */
export class LLMProvider {
  /** OpenAI 兼容 Provider (OpenAI + OpenRouter) */
  private openaiProvider: ReturnType<typeof createOpenAI> | null = null;

  /** Anthropic Provider */
  private anthropicProvider: ReturnType<typeof createAnthropic> | null = null;

  /** DeepSeek Provider */
  private deepseekProvider: ReturnType<typeof createDeepSeek> | null = null;

  /** OpenRouter Provider */
  private openrouterProvider: ReturnType<typeof createOpenRouter> | null = null;

  /**
   * 构造函数
   */
  constructor(config: Config) {
    if (config.providers.openai.apiKey) {
      const openaiConfig = {
        apiKey: config.providers.openai.apiKey,
        ...(config.providers.openai.apiBase && { baseURL: config.providers.openai.apiBase })
      };
      this.openaiProvider = createOpenAI(openaiConfig);
      logger.info('OpenAI Provider initialized');
    }

    if (config.providers.anthropic.apiKey) {
      this.anthropicProvider = createAnthropic({
        apiKey: config.providers.anthropic.apiKey,
      });
      logger.info('Anthropic Provider initialized');
    }
    if (config.providers.deepseek.apiKey) {
      this.deepseekProvider = createDeepSeek({
        apiKey: config.providers.deepseek.apiKey,
      });
      logger.info('DeepSeek Provider initialized');
    }
    if (config.providers.openrouter.apiKey) {
      this.openrouterProvider = createOpenRouter({
        apiKey: config.providers.openrouter.apiKey,
        baseURL: config.providers.openrouter.apiBase ?? 'https://openrouter.ai/api/v1',
      });
      logger.info('OpenRouter Provider initialized');
    }
  }

  /**
   * 获取当前请求对应的 model 实例
   */
  private getModel(providerName: string, modelName: string): LanguageModel {
    if (providerName === 'anthropic') {
      if (!this.anthropicProvider) {
        throw new Error('Anthropic Provider not initialized');
      }
      return this.anthropicProvider(modelName);
    }
    if (providerName === 'deepseek') {
      if (!this.deepseekProvider) {
        throw new Error('DeepSeek Provider not initialized');
      }
      return this.deepseekProvider(modelName);
    }
    if (providerName === 'openrouter') {
      if (!this.openrouterProvider) {
        throw new Error('OpenRouter Provider not initialized');
      }
      return this.openrouterProvider(modelName);
    }

    if (providerName === 'openai' || !this.openaiProvider) {
      if (!this.openaiProvider) {
        throw new Error('OpenAI Provider not initialized');
      }
      return this.openaiProvider(modelName);
    }

    return this.openaiProvider(modelName);
  }

  /**
   * 调用 LLM (使用 generateText)
   */
  async chat(params: {
    messages: Array<{ role: string; content: unknown; timestamp?: string }>;
    tools: ToolSet;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LLMResponse> {
    try {
      const { messages, tools, model: modelStr, temperature, maxTokens } = params;
      const { provider, modelName } = parseModelString(modelStr);

      logger.info(`Calling LLM: ${provider}:${modelName}`);

      const model = this.getModel(provider, modelName);
      const normalizedMessages = normalizeMessages(messages);

      const result = await generateText({
        model,
        messages: normalizedMessages,
        tools,
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 4096,
        stopWhen: [stepCountIs(3)],
      }).then((r) => r, (e: unknown) => {
        if (e === undefined || e === null) {
          throw new Error('generateText rejected with undefined/null (often fetch/network or SDK bug)');
        }
        throw e;
      });

      const toolCalls: ToolCall[] = (result.toolCalls ?? []).map((tc) => ({
        id: tc.toolCallId,
        name: tc.toolName,
        arguments: (tc as { input?: Record<string, unknown> }).input ?? {},
      }));

      const content = typeof result.text === 'string' ? result.text : '';

      const usage = result.usage
        ? {
          promptTokens: result.usage.inputTokens ?? 0,
          completionTokens: result.usage.outputTokens ?? 0,
          totalTokens: result.usage.totalTokens ?? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
        }
        : undefined;

      return {
        content,
        hasToolCalls: toolCalls.length > 0,
        toolCalls,
        ...(usage && { usage }),
      };
    } catch (error) {
      const normalized =
        error === undefined || error === null
          ? new Error('LLM call failed (rejected with undefined/null); check generateText/tools.')
          : error;
      const errorMsg = `LLM call failed: ${normalized instanceof Error ? normalized.message : String(normalized)}`;
      logger.error(errorMsg);
      throw new ProviderError(errorMsg);
    }
  }
}
