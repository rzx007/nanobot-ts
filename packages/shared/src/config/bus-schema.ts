/**
 * 消息总线 Schema 定义
 *
 * 使用 Zod 定义消息总线的类型结构
 */

import { z } from 'zod';
import { ToolCallSchema } from './tool-schema';

/**
 * 入站消息 - 从聊天渠道接收到的消息
 */
export const InboundMessageSchema = z.object({
  /** 渠道标识 (whatsapp, feishu, email, cli) */
  channel: z.string(),

  /** 发送者标识 (用户ID) */
  senderId: z.string(),

  /** 聊天标识 (会话ID) */
  chatId: z.string(),

  /** 消息内容 */
  content: z.string(),

  /** 时间戳 */
  timestamp: z.date(),

  /** 媒体文件列表 (图片、文档等) */
  media: z.array(z.string()).optional(),

  /** 渠道特定的元数据 */
  metadata: z.record(z.string(), z.unknown()).optional(),

  /** 会话密钥覆盖 (用于线程作用域的会话，未指定时用 channel:chatId) */
  sessionKeyOverride: z.string().optional(),

  /** 取消信号（用于中止正在进行的对话） */
  abortSignal: z.any().optional(),
});

/**
 * 获取入站消息的会话密钥
 */
export function getSessionKey(
  msg: Pick<InboundMessage, 'channel' | 'chatId' | 'sessionKeyOverride'>,
): string {
  return msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
}

/**
 * 出站消息 - 要发送到聊天渠道的消息
 */
export const OutboundMessageSchema = z.object({
  /** 目标渠道 */
  channel: z.string(),

  /** 聊天标识 (会话ID) */
  chatId: z.string(),

  /** 消息内容 */
  content: z.string(),

  /** 回复到的消息 ID */
  replyTo: z.string().optional(),

  /** 媒体文件列表 */
  media: z.array(z.string()).optional(),

  /** 渠道特定的元数据 */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * LLM 响应
 * 从 LLM 提供商获取的响应
 */
export const LLMResponseSchema = z.object({
  /** 响应内容 (文本) */
  content: z.string(),

  /** 是否有工具调用 */
  hasToolCalls: z.boolean(),

  /** 工具调用列表 */
  toolCalls: z.array(ToolCallSchema),

  /** 使用统计 (可选) */
  usage: z
    .object({
      /** 提示词 Token 数 */
      promptTokens: z.number().int().positive(),

      /** 完成 Token 数 */
      completionTokens: z.number().int().positive(),

      /** 总 Token 数 */
      totalTokens: z.number().int().positive(),
    })
    .optional(),
});

/**
 * 流式文本事件
 * 用于消息总线的流式输出事件
 */
export const StreamTextEventSchema = z.object({
  /** 目标渠道 */
  channel: z.string(),

  /** 聊天标识 */
  chatId: z.string(),

  /** 文本块内容 */
  chunk: z.string(),

  /** 渠道特定的元数据 */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 工具提示事件
 * 用于消息总线的工具执行提示事件
 */
export const ToolHintEventSchema = z.object({
  /** 目标渠道 */
  channel: z.string(),

  /** 聊天标识 */
  chatId: z.string(),

  /** 提示内容 */
  content: z.string(),
});

/**
 * 进度选项
 * 用于 onProgress 回调的额外选项
 */
export const ProgressOptionsSchema = z.object({
  /** 工具提示 (是否为工具调用提示) */
  toolHint: z.boolean().optional(),
});

/**
 * 入站消息
 */
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

/**
 * 出站消息
 */
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

/**
 * LLM 响应
 * 从 LLM 提供商获取的响应
 */
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * 流式文本事件
 * 用于消息总线的流式输出事件
 */
export type StreamTextEvent = z.infer<typeof StreamTextEventSchema>;

/**
 * 工具提示事件
 * 用于消息总线的工具执行提示事件
 */
export type ToolHintEvent = z.infer<typeof ToolHintEventSchema>;

/**
 * 进度选项
 * 用于 onProgress 回调的额外选项
 */
export type ProgressOptions = z.infer<typeof ProgressOptionsSchema>;

/**
 * 消息总线队列状态（用于调试与健康检查）
 */
export interface MessageBusStatus {
  inboundQueueLength: number;
  outboundQueueLength: number;
  inboundConsumersLength: number;
  outboundConsumersLength: number;
}

/**
 * 消息总线接口
 *
 * 供 ChannelManager、渠道、ApprovalManager、QuestionManager 等组件使用，解耦具体实现。
 * 入站/出站消息为队列语义；流式、工具提示、审批、提问为事件广播语义。
 */
export interface IMessageBus {
  /** 发布入站消息 */
  publishInbound(msg: InboundMessage): Promise<void>;

  /** 发布出站消息 */
  publishOutbound(msg: OutboundMessage): Promise<void>;

  /** 消费入站消息 (阻塞直到有消息) */
  consumeInbound(): Promise<InboundMessage>;

  /** 消费出站消息 (阻塞直到有消息) */
  consumeOutbound(): Promise<OutboundMessage>;

  /** 添加入站消息过滤器（返回 true 表示拦截，不入队） */
  addInboundFilter(filter: (msg: InboundMessage) => boolean): void;

  /** 获取队列状态（用于调试与健康检查） */
  getStatus(): MessageBusStatus;
}
