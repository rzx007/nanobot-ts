/**
 * LLM Provider 实现
 *
 * 使用 Vercel AI SDK 的 generateText，通过适配器注册表调用各供应商。
 * 参考: https://sdk.vercel.ai/docs/ai-sdk-core/generating-text
 */

import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from 'ai';
import type { LLMResponse, ToolSet } from '../bus/types';
import type { Config } from '../config/schema';
import { parseModelString } from '../utils/helpers';
import { logger } from '../utils/logger';
import { ProviderError } from '../utils/errors';
import { withRetryAndRateLimit, createRetryState } from '../utils/retry';
import type { ProviderRegistry } from './types';
import { createProviderRegistry } from './adapters';

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
 * 通过 Provider 注册表统一调用各供应商，新增供应商只需在 adapters 中注册。
 */
export class LLMProvider {
  private registry: ProviderRegistry;
  private retryState = createRetryState();

  constructor(config: Config) {
    this.registry = createProviderRegistry(config);
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
   * 根据 provider 与 model 名获取 LanguageModel
   * 未指定或未知 provider 时回退到 deepseek
   */
  private getModel(providerName: string, modelName: string): LanguageModel {
    const factory =
      this.registry.get(providerName) ?? this.registry.get('deepseek');
    if (!factory) {
      throw new Error(
        `No provider available for "${providerName}". Ensure at least one provider (e.g. deepseek) is configured with apiKey.`,
      );
    }
    return factory(modelName);
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
            stopWhen: [stepCountIs(maxSteps ?? 5)],
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
