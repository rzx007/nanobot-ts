import { request } from '@/lib/request';
import type {
  QuestionEvent,
  ApprovalEvent,
  StreamPartPayload,
  StreamFinishEvent,
} from '@nanobot/shared';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
        let currentEvent: string | null = null;
        const dataLines: string[] = [];

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('event: ')) {
            currentEvent = trimmedLine.slice(7);
          } else if (trimmedLine.startsWith('data: ')) {
            dataLines.push(trimmedLine.slice(6));
          }
        }

        const data = dataLines.join('\n');
        if (!data) continue;

        if (data === '[DONE]' || currentEvent === 'done') {
          callbacks.onDone?.();
          return;
        }

        if (currentEvent === 'part') {
          const part = JSON.parse(data) as StreamPartPayload;
          callbacks.onPart?.(part);
          if (part.type === 'text-delta') {
            callbacks.onChunk?.(part.text);
          }
          continue;
        }

        if (currentEvent === 'finish') {
          const finishEvent = JSON.parse(data) as StreamFinishEvent;
          callbacks.onFinish?.(finishEvent);
          continue;
        }

        if (currentEvent === 'question') {
          const questionEvent = JSON.parse(data) as QuestionEvent;
          callbacks.onQuestion?.(questionEvent);
          continue;
        }

        if (currentEvent === 'approval') {
          const approvalEvent = JSON.parse(data) as ApprovalEvent;
          callbacks.onApproval?.(approvalEvent);
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
