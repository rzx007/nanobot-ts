/**
 * 消息相关端点
 */

import { Hono } from 'hono';
import { streamSSE } from "hono/streaming"
import { z } from 'zod';
import type { AppContext } from '../types';
import type { MessageBus } from '@nanobot/main';
import { ValidationError } from '../types';
import type { StreamFinishEvent, StreamPartEvent } from '@nanobot/providers';
import type { ApprovalEvent, QuestionEvent } from '@nanobot/shared';

const app = new Hono<AppContext>();

/**
 * POST /api/v1/messages - 发送消息
 */
app.post('/messages', async c => {
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
    return streamSSE(c, async (stream) => {
      // 流式部分监听器：直接输出 UIMessageChunk（AI SDK 标准格式）
      const streamPartListener = (event: StreamPartEvent) => {
        if (event.channel === 'http' && event.chatId === chatId) {
          stream.writeSSE({
            data: JSON.stringify(event.part),
          });
        }
      };

      // 完成事件监听器：输出标准 finish 类型
      const streamFinishListener = (event: StreamFinishEvent) => {
        if (event.channel === 'http' && event.chatId === chatId) {
          stream.writeSSE({
            data: JSON.stringify({
              type: 'finish',
              finishReason: event.part.finishReason,
              messageMetadata: {
                assistantContent: event.part.assistantContent,
                usage: event.part.usage,
                totalUsage: event.part.totalUsage,
                toolCalls: event.part.toolCalls,
              },
            }),
          });
          stream.writeSSE({
            data: '[DONE]',
          });
        }
      };

      // 问题监听器：转换为 data-question 格式（AI SDK 标准）
      const questionListener = (event: QuestionEvent) => {
        if (event.channel === 'http' && event.chatId === chatId) {
          stream.writeSSE({
            data: JSON.stringify({
              type: 'data-question',
              data: {
                type: event.type,
                requestID: event.requestID,
                questions: event.questions,
                timestamp: event.timestamp.getTime(),
              },
            }),
          });
        }
      };

      // 审批监听器：转换为 data-approval 格式（AI SDK 标准）
      const approvalListener = (event: ApprovalEvent) => {
        if (event.channel === 'http' && event.chatId === chatId) {
          stream.writeSSE({
            data: JSON.stringify({
              type: 'data-approval',
              data: {
                type: event.type,
                requestID: event.requestID,
                toolName: event.toolName,
                params: event.params,
                timeout: event.timeout,
                timestamp: event.timestamp.getTime(),
              },
            }),
          });
        }
      };

      // 注册所有监听器
      bus.on('stream-part', streamPartListener);
      bus.on('stream-finish', streamFinishListener);
      bus.on('question', questionListener);
      bus.on('approval', approvalListener);

      // 心跳保持连接活跃（每30秒）
      const heartbeat = setInterval(() => {
        stream.writeSSE({
          event: 'heartbeat',
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 30_000);

      // 保持连接直到客户端断开
      await new Promise<void>((resolve) => {
        stream.onAbort(() => {
          clearInterval(heartbeat);
          bus.off('stream-part', streamPartListener);
          bus.off('stream-finish', streamFinishListener);
          bus.off('question', questionListener);
          bus.off('approval', approvalListener);
          resolve();
        });
      });
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
app.get('/messages/:chatId', async c => {
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
app.delete('/messages/:chatId', async c => {
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
