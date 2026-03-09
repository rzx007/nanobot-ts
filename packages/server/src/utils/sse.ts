/**
 * SSE (Server-Sent Events) 工具函数
 */

import type { Context } from 'hono';
import type { StreamTextEvent } from '@nanobot/shared';
import type { OutboundMessage } from '@nanobot/shared';
import type { SSEEvent } from '../types';
import type { MessageBus } from '@/bus/queue';

/**
 * 创建 SSE 流
 */
export async function streamSSE(
  _c: Context,
  handler: (stream: SSEStream) => Promise<void | (() => void)>,
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sseStream: SSEStream = {
        write: (event: SSEEvent) => {
          const lines: string[] = [];
          if (event.event) lines.push(`event: ${event.event}`);
          if (event.id) lines.push(`id: ${event.id}`);
          if (event.retry) lines.push(`retry: ${event.retry}`);
          lines.push(`data: ${event.data}`);
          lines.push('');
          controller.enqueue(encoder.encode(lines.join('\n')));
        },
        writeSSE: event => {
          const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
          const lines: string[] = [];
          if (event.event) lines.push(`event: ${event.event}`);
          if (event.id) lines.push(`id: ${event.id}`);
          if (event.retry) lines.push(`retry: ${event.retry}`);
          lines.push(`data: ${data}`);
          lines.push('');
          controller.enqueue(encoder.encode(lines.join('\n')));
        },
        close: () => {
          controller.close();
        },
      };

      const cleanup = await handler(sseStream);

      return new Promise<void>(resolve => {
        setTimeout(() => {
          cleanup?.();
          controller.close();
          resolve();
        }, 1000);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * SSE 流接口
 */
export interface SSEStream {
  /**
   * 写入 SSE 事件
   */
  write: (event: SSEEvent) => void;

  /**
   * 写入 SSE 事件（自动序列化 data）
   */
  writeSSE: (event: SSEEvent) => void;

  /**
   * 关闭流
   */
  close: () => void;
}

/**
 * 为消息总线设置 SSE 监听器
 */
export function setupStreamListener(
  bus: MessageBus,
  chatId: string,
  stream: SSEStream,
): () => void {
  const streamTextListener = (event: StreamTextEvent) => {
    if (event.channel === 'http' && event.chatId === chatId) {
      stream.writeSSE({ data: event.chunk });
    }
  };

  const outboundListener = (msg: OutboundMessage) => {
    if (msg.channel === 'http' && msg.chatId === chatId) {
      stream.writeSSE({ event: 'done', data: '[DONE]' });
    }
  };

  bus.on('stream-text', streamTextListener);
  bus.on('outbound', outboundListener);

  return () => {
    bus.off('stream-text', streamTextListener);
    bus.off('outbound', outboundListener);
  };
}
