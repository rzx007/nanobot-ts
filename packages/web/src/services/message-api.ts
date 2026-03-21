import { request } from '@/lib/request';
import type { StreamFinishEvent, StreamPartPayload } from '@nanobot/providers';
import type { QuestionEvent, ApprovalEvent } from '@nanobot/shared';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  id?: string;
  parts?: unknown[];
  metadata?: unknown;
}

export interface MessageStreamCallbacks {
  onPart?: (part: StreamPartPayload) => void;
  onChunk?: (chunk: string) => void;
  onFinish?: (event: StreamFinishEvent) => void;
  onDone?: () => void;
  onQuestion?: (event: QuestionEvent) => void;
  onApproval?: (event: ApprovalEvent) => void;
  onError?: (error: Error) => void;
}

/**
 * 发送消息并接收SSE流
 *
 * @deprecated 推荐使用 @/hooks/use-chat
 */
export async function sendMessage(
  content: string,
  chatId: string,
  callbacks: MessageStreamCallbacks = {}
): Promise<void> {
  try {
    const response = await request.raw('/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ content, chatId, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body for SSE stream');
    }
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const rawEvent of events) {
        const lines = rawEvent.split('\n');
        const dataLines: string[] = [];

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('event: ')) {
            continue;
          } else if (trimmedLine.startsWith('data: ')) {
            dataLines.push(trimmedLine.slice(6));
          }
        }

        const data = dataLines.join('\n').trim();
        if (!data) continue;

        if (data === '[DONE]') {
          callbacks.onDone?.();
          return;
        }

        try {
          const parsed = JSON.parse(data);

          // 根据类型区分事件
          if (parsed.type === 'finish' && callbacks.onFinish) {
            // 新格式：finish 数据在 messageMetadata 中
            const finishEvent: StreamFinishEvent = {
              channel: 'http',
              chatId: '',
              part: {
                type: 'finish',
                finishReason: parsed.finishReason,
                assistantContent: parsed.messageMetadata?.assistantContent,
                usage: parsed.messageMetadata?.usage,
                totalUsage: parsed.messageMetadata?.totalUsage,
                toolCalls: parsed.messageMetadata?.toolCalls,
              },
            };
            callbacks.onFinish(finishEvent);
            continue;
          }

          if (parsed.type === 'data-question' && callbacks.onQuestion) {
            // 新格式：data-question
            const questionEvent: QuestionEvent = {
              type: parsed.data.type,
              requestID: parsed.data.requestID,
              channel: 'http',
              chatId: chatId,
              questions: parsed.data.questions,
              timestamp: new Date(parsed.data.timestamp),
            };
            callbacks.onQuestion?.(questionEvent);
            continue;
          }

          if (parsed.type === 'data-approval' && callbacks.onApproval) {
            // 新格式：data-approval
            const approvalEvent: ApprovalEvent = {
              type: parsed.data.type,
              requestID: parsed.data.requestID,
              channel: 'http',
              chatId: chatId,
              toolName: parsed.data.toolName,
              params: parsed.data.params,
              timeout: parsed.data.timeout,
              timestamp: new Date(parsed.data.timestamp),
            };
            callbacks.onApproval?.(approvalEvent);
            continue;
          }

          // 默认为 UIMessageChunk
          if (callbacks.onPart) {
            callbacks.onPart(parsed as StreamPartPayload);
          }
        } catch (e) {
          console.error('[sendMessage] Parse SSE error:', e);
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error as Error);
  }
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(
  chatId: string
): Promise<ChatHistoryItem[]> {
  const result = await request<{ data: { history: ChatHistoryItem[] } }>(`/api/v1/messages/${chatId}`);
  return result.data?.history || [];
}

/**
 * 清空聊天历史
 */
export async function clearChatHistory(chatId: string): Promise<void> {
  await request(`/api/v1/messages/${chatId}`, { method: 'DELETE' });
}
