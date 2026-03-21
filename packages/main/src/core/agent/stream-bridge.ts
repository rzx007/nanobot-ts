import type {
  LLMProvider,
  OnChunkResult,
  StreamFinishPart,
  StreamPartPayload,
} from '@nanobot/providers';
import type { MessageBus } from '../../bus';
import type { ToolSet } from '@nanobot/shared';
import type { UIMessage, UIMessageChunk } from 'ai';
import { readUIMessageStream } from 'ai';

export interface StreamBridgeDeps {
  provider: LLMProvider;
  bus: MessageBus;
}

export interface StreamBridgeRunOptions<TOOLS extends ToolSet> {
  channel: string;
  chatId: string;
  messages: Array<{ role: string; content: unknown; timestamp?: string }>;
  tools: TOOLS;
  model: string;
  temperature?: number;
  maxTokens?: number;
  abortSignal: AbortSignal;
  maxSteps: number;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  senderId?: string;
}

export interface StreamBridgeResult<TOOLS extends ToolSet> {
  assistantContent: string;
  parts: UIMessageChunk[];
  finalUIMessage?: UIMessage;
}

export class StreamBridge {
  constructor(private readonly deps: StreamBridgeDeps) { }

  async streamAndEmit<TOOLS extends ToolSet>(
    options: StreamBridgeRunOptions<TOOLS>,
  ): Promise<StreamBridgeResult<TOOLS>> {
    const { channel, chatId, senderId } = options;

    let fallbackFinishReason: StreamFinishPart<TOOLS>['finishReason'] | undefined;
    let fallbackUsage: StreamFinishPart<TOOLS>['usage'] | undefined;
    let fallbackTotalUsage: StreamFinishPart<TOOLS>['totalUsage'] | undefined;
    let fallbackToolCalls: StreamFinishPart<TOOLS>['toolCalls'] | undefined;
    let finishEmitted = false;

    const parts: UIMessageChunk[] = [];
    let finalUIMessage: UIMessage | undefined;

    const streamResult = await this.deps.provider.streamChat({
      messages: options.messages,
      tools: options.tools,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      abortSignal: options.abortSignal,
      maxSteps: options.maxSteps,
      executeTool: options.executeTool,
      onChunk: (event: OnChunkResult<TOOLS>) => {
        if (event.type === 'chunk') {
          parts.push(event.chunk);
          this.deps.bus.emit('stream-part', { channel, chatId, part: event.chunk, senderId });
          return;
        }
        if (event.type === 'finish') {
          const part: StreamFinishPart<TOOLS> = {
            type: 'finish',
            finishReason: event.finish.finishReason,
            usage: event.finish.usage,
            totalUsage: event.finish.totalUsage,
            toolCalls: event.finish.toolCalls,
            assistantContent: event.assistantContent,
          };
          fallbackFinishReason = part.finishReason;
          fallbackUsage = part.usage;
          fallbackTotalUsage = part.totalUsage;
          fallbackToolCalls = part.toolCalls;
          this.deps.bus.emit('stream-finish', { channel, chatId, part, senderId });
          finishEmitted = true;
          return;
        }
        if (event.type === 'error') {
          this.deps.bus.emit('stream-part', {
            channel,
            chatId,
            part: { type: 'error', errorText: event.error.message },
            senderId,
          });
          return;
        }
        if (event.type === 'nanobot-abort') {
          this.deps.bus.emit('stream-part', {
            channel,
            chatId,
            part: {
              type: 'nanobot-abort',
              steps: event.steps,
            } as unknown as StreamPartPayload,
            senderId,
          });
        }
      },
    });

    // 使用 readUIMessageStream 收集最终的完整 UIMessage
    try {
      for await (const uiMessage of readUIMessageStream({
        stream: streamResult.toUIMessageStream(),
      })) {
        // 最后一个 uiMessage 就是完整的 UIMessage
        finalUIMessage = uiMessage;
      }
    } catch (e) {
      console.error('[StreamBridge] Failed to read UIMessage stream:', e);
    }

    const streamedText = await streamResult.text;
    const assistantContent = typeof streamedText === 'string' ? streamedText : '';

    if (!finishEmitted) {
      const fallbackPart: StreamFinishPart<TOOLS> = {
        type: 'finish',
        assistantContent,
        finishReason: fallbackFinishReason,
        usage: fallbackUsage,
        totalUsage: fallbackTotalUsage,
        toolCalls: fallbackToolCalls,
      };
      this.deps.bus.emit('stream-finish', {
        channel,
        chatId,
        part: fallbackPart,
        senderId,
      });
    }

    return { assistantContent, parts, finalUIMessage };
  }
}
