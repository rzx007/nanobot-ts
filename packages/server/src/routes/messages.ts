/**
 * 消息相关端点
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../types';
import type { MessageBus } from '@/bus/queue';
import type { SSEStream } from '../utils/sse';
import { ValidationError } from '../types';

const app = new Hono<AppContext>();

/**
 * POST /api/v1/messages - 发送消息
 */
app.post('/api/v1/messages', async c => {
  const schema = z.object({
    content: z.string().min(1),
    chatId: z.string().optional(),
    stream: z.boolean().default(true),
    metadata: z.record(z.string(), z.any()).optional(),
  });

  const body = await c.req.json();
  const validated = schema.safeParse(body);

  if (!validated.success) {
    throw new ValidationError('Validation failed', validated.error.issues);
  }

  const { content, chatId = `http-${Date.now()}`, stream: enableStream, metadata } = validated.data;

  const bus = c.get('bus') as MessageBus;
  const sessionId = `http:${chatId}`;

  await bus.publishInbound({
    channel: 'http',
    senderId: 'api',
    chatId,
    content,
    timestamp: new Date(),
    ...(metadata !== undefined ? { metadata } : {}),
    sessionKeyOverride: sessionId,
  });

  if (enableStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sseStream: SSEStream = {
          write: event => {
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

        const streamTextListener = (evt: unknown) => {
          const event = evt as { channel: string; chatId: string; chunk: string };
          if (event.channel === 'http' && event.chatId === chatId) {
            sseStream.writeSSE({ data: event.chunk });
          }
        };

        const outboundListener = (msg: unknown) => {
          const outbound = msg as { channel: string; chatId: string };
          if (outbound.channel === 'http' && outbound.chatId === chatId) {
            sseStream.writeSSE({ event: 'done', data: '[DONE]' });
          }
        };

        bus.on('stream-text', streamTextListener);
        bus.on('outbound', outboundListener);

        return new Promise<void>(resolve => {
          setTimeout(() => {
            bus.off('stream-text', streamTextListener);
            bus.off('outbound', outboundListener);
            controller.close();
            resolve();
          }, 300000);
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

  return c.json({
    code: 200,
    message: 'Message sent',
    data: {
      chatId,
      sessionId,
    },
  });
});

/**
 * GET /api/v1/messages/:chatId - 获取聊天历史
 */
app.get('/api/v1/messages/:chatId', async c => {
  const chatId = c.req.param('chatId');
  const sessions = c.get('runtime').sessions;
  const sessionId = `http:${chatId}`;

  const history = await sessions.getHistory(sessionId);

  return c.json({
    code: 200,
    message: 'Chat history retrieved',
    data: {
      chatId,
      sessionId,
      history,
    },
  });
});

/**
 * DELETE /api/v1/messages/:chatId - 清空会话历史
 */
app.delete('/api/v1/messages/:chatId', async c => {
  const chatId = c.req.param('chatId');
  const sessions = c.get('runtime').sessions;
  const sessionId = `http:${chatId}`;

  await sessions.clear(sessionId);

  return c.json({
    code: 200,
    message: 'Session cleared',
    data: {
      chatId,
      sessionId,
    },
  });
});

export default app;
