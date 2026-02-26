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
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGroq } from '@ai-sdk/groq';
import type { LLMResponse, ToolSet } from '../bus/events';
import type { Config } from '../config/schema';
import { parseModelString } from '../utils/helpers';
import { logger } from '../utils/logger';
import { ProviderError } from '../utils/errors';
import { withRetryAndRateLimit, createRetryState } from '../utils/retry';

/**
 * 将 agent 的 messages 转换为 AI SDK ModelMessage 格式
 * agent 的 tool 消息可能是 { role:'tool', content: string } 或 { role:'tool', content: ToolResultPart[] }
 */
function normalizeMessages(
  messages: Array<{ role: string; content: unknown; timestamp?: string }>,
): ModelMessage[] {
  return messages.map(msg => {
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

  /** Groq Provider */
  private groqProvider: ReturnType<typeof createGroq> | null = null;

  /** 重试状态 */
  private retryState = createRetryState();

  /**
   * 构造函数
   */
  constructor(config: Config) {
    if (config.providers.openai.apiKey) {
      const openaiConfig = {
        apiKey: config.providers.openai.apiKey,
        ...(config.providers.openai.apiBase && { baseURL: config.providers.openai.apiBase }),
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
    if (config.providers.groq?.apiKey) {
      this.groqProvider = createGroq({
        apiKey: config.providers.groq.apiKey,
      });
      logger.info('Groq Provider initialized');
    }
  }

  /**
   * 为每个 tool 注入 execute，供 SDK 自动执行
   */
  private buildToolsWithExecute(
    tools: ToolSet,
    executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  ): ToolSet {
    const out: ToolSet = {};
    for (const [name, def] of Object.entries(tools)) {
      out[name] = {
        ...def,
        execute: async (args: Record<string, unknown>) => executeTool(name, args ?? {}),
      } as (typeof tools)[string];
    }
    return out;
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
    if (providerName === 'groq') {
      if (!this.groqProvider) {
        throw new Error('Groq Provider not initialized');
      }
      return this.groqProvider(modelName);
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
   * 若传入 executeTool，则 tools 会带上 execute，由 SDK 在内部多步循环中自动执行工具；
   * 否则仅一轮，不执行工具（兼容旧用法）。
   */
  async chat(params: {
    messages: Array<{ role: string; content: unknown; timestamp?: string }>;
    tools: ToolSet;
    model: string;
    temperature?: number;
    maxTokens?: number;
    /** 工具执行器；传入后 SDK 会自动执行工具并循环直到无 tool call 或达到 maxSteps */
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
    /** 最大步数（每步一次 LLM 调用 + 可选工具执行），默认 1；与 executeTool 配合使用 */
    maxSteps?: number;
    /** 每步结束回调（如用于进度） */
    onStepFinish?: (step: { text?: string; toolCalls?: unknown[] }) => void;
  }): Promise<LLMResponse> {
    try {
      const {
        messages,
        tools,
        model: modelStr,
        temperature,
        maxTokens,
        executeTool,
        maxSteps = 1,
        onStepFinish,
      } = params;
      const { provider, modelName } = parseModelString(modelStr);

      logger.info(`Calling LLM: ${provider}:${modelName}`);

      const model = this.getModel(provider, modelName);
      const normalizedMessages = normalizeMessages(messages);

      const toolsToUse =
        executeTool != null ? this.buildToolsWithExecute(tools, executeTool) : tools;

      const result = await withRetryAndRateLimit(
        () =>
          generateText({
            model,
            messages: normalizedMessages,
            tools: toolsToUse,
            temperature: temperature ?? 0.7,
            maxOutputTokens: maxTokens ?? 4096,
            stopWhen: [stepCountIs(maxSteps ?? 3)],
            ...(onStepFinish && { onStepFinish }),
          }),
        `LLM call: ${provider}:${modelName}`,
        this.retryState,
      );

      const content = typeof result.text === 'string' ? result.text : '';

      const usage = result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens:
              result.usage.totalTokens ??
              (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
          }
        : undefined;

      return {
        content,
        hasToolCalls: false,
        toolCalls: [],
        ...(usage && { usage }),
      };
    } catch (error) {
      const err =
        error ??
        new Error('LLM call failed (rejected with undefined/null); check generateText/tools.');
      const errorMsg = `LLM call failed: ${err instanceof Error ? err.message : String(err)}`;
      logger.error(errorMsg);
      throw new ProviderError(errorMsg);
    }
  }
}
