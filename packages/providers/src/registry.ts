/**
 * LLM Provider 实现
 *
 * 使用 Vercel AI SDK 的 streamText，通过适配器注册表调用各供应商；
 * 流式输出经 toUIMessageStream() 转为 UIMessageChunk，与 useChat / AI SDK UI 协议对齐。
 */

import {
  streamText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type OnFinishEvent,
  type StepResult,
  type StreamTextResult,
} from 'ai';
import type { ToolSet, Config } from '@nanobot/shared';
import { parseModelString } from '@nanobot/utils';
import { logger } from '@nanobot/logger';
import { ProviderError } from '@nanobot/utils';
import { withRetryAndRateLimit, createRetryState } from '@nanobot/utils';
import type { LLMProvider, OnChunkResult, StreamChatParams } from './types';
import { createProviderRegistry } from './adapters';

/**
 * 将 agent 的 messages 转换为 AI SDK ModelMessage 格式
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
 * LLM Provider 实现
 *
 * 通过 Provider 注册表统一调用各供应商，新增供应商只需在 adapters 中注册。
 */
export class LLMProviderImpl implements LLMProvider {
  private registry: ReturnType<typeof createProviderRegistry>;
  private retryState = createRetryState();

  constructor(config: Config) {
    this.registry = createProviderRegistry(config);
  }

  /**
   * 为每个 tool 注入 execute，供 SDK 自动执行
   */
  private buildToolsWithExecute<TOOLS extends ToolSet>(
    tools: TOOLS,
    executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  ): TOOLS {
    const out: any = {};
    for (const [name, def] of Object.entries(tools)) {
      out[name] = {
        ...def,
        execute: async (args: Record<string, unknown>) => executeTool(name, args ?? {}),
      };
    }
    return out as TOOLS;
  }

  /**
   * 根据 provider 与 model 名获取 LanguageModel
   */
  private getModel(providerName: string, modelName: string): LanguageModel {
    const factory = this.registry.get(providerName) ?? this.registry.get('deepseek');
    if (!factory) {
      throw new Error(
        `No provider available for "${providerName}". Ensure at least one provider (e.g. deepseek) is configured with apiKey.`,
      );
    }
    return factory(modelName);
  }

  /**
   * 调用 LLM（统一使用 streamText）
   */
  async streamChat<TOOLS extends ToolSet>(
    params: StreamChatParams<TOOLS>,
  ): Promise<StreamTextResult<TOOLS, any>> {
    const { onError } = params;
    let assistantContent = '';

    try {
      if (params?.abortSignal?.aborted) {
        throw new DOMException('Task cancelled', 'AbortError');
      }

      const {
        messages,
        tools,
        model: modelStr,
        temperature,
        maxTokens,
        executeTool,
        maxSteps,
        onChunk,
        onFinish,
        onAbort,
      } = params;
      const { provider, modelName } = parseModelString(modelStr);

      logger.info(`Calling LLM stream: ${provider}:${modelName}`);

      const model = this.getModel(provider, modelName);
      const normalizedMessages = normalizeMessages(messages);
      const toolsToUse =
        executeTool != null ? this.buildToolsWithExecute(tools, executeTool) : tools;

      const callbacks: Record<string, Function> = {};

      callbacks.onFinish = (event: OnFinishEvent<TOOLS>) => {
        const finalText = typeof (event as { text?: unknown }).text === 'string'
          ? String((event as { text?: unknown }).text)
          : assistantContent;
        const finalAssistantContent = finalText.trim();
        onChunk?.({ type: 'finish', finish: event, assistantContent: finalAssistantContent });
        onFinish?.(event);
      };

      callbacks.onError = ({ error }: { error: unknown }) => {
        const err = error instanceof Error ? error : new Error(String(error));
        onChunk?.({ type: 'error', error: err });
        onError?.(err);
      };

      callbacks.onAbort = ({ steps }: { steps: StepResult<TOOLS>[] }) => {
        onChunk?.({ type: 'nanobot-abort', steps });
        onAbort?.({ steps });
      };

      const result = await withRetryAndRateLimit(
        async () =>
          streamText({
            model,
            messages: normalizedMessages,
            tools: toolsToUse,
            temperature: temperature ?? 0.7,
            maxOutputTokens: params.maxOutputTokens ?? maxTokens ?? 4096,
            stopWhen: [stepCountIs(maxSteps ?? 5)],
            abortSignal: params?.abortSignal ?? new AbortController().signal,
            ...callbacks,
          }),
        `LLM call: ${provider}:${modelName}`,
        this.retryState,
      );

      void (async () => {
        try {
          for await (const chunk of result.toUIMessageStream()) {
            if (chunk.type === 'text-delta') {
              assistantContent += chunk.delta;
            }
            onChunk?.({ type: 'chunk', chunk } as OnChunkResult<TOOLS>);
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error(String(e));
          logger.error(`UI message stream failed: ${err.message}`);
          onChunk?.({ type: 'error', error: err });
          onError?.(err);
        }
      })();

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMsg = `LLM stream call failed: ${err.message}`;
      logger.error(errorMsg);
      if (onError) onError(err);
      throw new ProviderError(errorMsg);
    }
  }
}
