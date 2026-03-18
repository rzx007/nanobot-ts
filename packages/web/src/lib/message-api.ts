import { request } from './request';
import type { QuestionEvent } from '@nanobot/shared';

export interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface MessageStreamCallbacks {
  onChunk?: (chunk: string) => void;
  onDone?: () => void;
  onQuestion?: (event: QuestionEvent) => void;
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

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let currentEvent: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('event: ')) {
          currentEvent = trimmedLine.slice(7);
        } else if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);

          if (data === '[DONE]') {
            callbacks.onDone?.();
            return;
          }

          if (currentEvent === 'question') {
            const questionEvent = JSON.parse(data) as QuestionEvent;
            callbacks.onQuestion?.(questionEvent);
          } else if (currentEvent === 'stream-text') {
            callbacks.onChunk?.(data);
          }
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
