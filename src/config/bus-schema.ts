/**
 * 消息总线 Schema 定义
 *
 * 使用 Zod 定义消息总线的类型结构
 */

import { z } from 'zod';

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
 * 工具调用
 * LLM 返回的工具调用请求
 */
export const ToolCallSchema = z.object({
  /** 工具调用 ID */
  id: z.string(),

  /** 工具名称 */
  name: z.string(),

  /** 工具参数 (已解析的 JSON) */
  arguments: z.record(z.string(), z.unknown()),
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
export interface InboundMessage {
  /** 渠道标识 (whatsapp, feishu, email, cli) */
  channel: string;

  /** 发送者标识 (用户ID) */
  senderId: string;

  /** 聊天标识 (会话ID) */
  chatId: string;

  /** 消息内容 */
  content: string;

  /** 时间戳 */
  timestamp: Date;

  /** 媒体文件列表 (图片、文档等) */
  media?: string[];

  /** 渠道特定的元数据 */
  metadata?: Record<string, unknown>;

  /** 会话密钥覆盖 (用于线程作用域的会话，未指定时用 channel:chatId) */
  sessionKeyOverride?: string;
}

/**
 * 出站消息
 */
export interface OutboundMessage {
  /** 目标渠道 */
  channel: string;

  /** 聊天标识 (会话ID) */
  chatId: string;

  /** 消息内容 */
  content: string;

  /** 回复到的消息 ID */
  replyTo?: string;

  /** 媒体文件列表 */
  media?: string[];

  /** 渠道特定的元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 工具调用
 * LLM 返回的工具调用请求
 */
export interface ToolCall {
  /** 工具调用 ID */
  id: string;

  /** 工具名称 */
  name: string;

  /** 工具参数 (已解析的 JSON) */
  arguments: Record<string, unknown>;
}

/**
 * LLM 响应
 * 从 LLM 提供商获取的响应
 */
export interface LLMResponse {
  /** 响应内容 (文本) */
  content: string;

  /** 是否有工具调用 */
  hasToolCalls: boolean;

  /** 工具调用列表 */
  toolCalls: ToolCall[];

  /** 使用统计 (可选) */
  usage?: {
    /** 提示词 Token 数 */
    promptTokens: number;

    /** 完成 Token 数 */
    completionTokens: number;

    /** 总 Token 数 */
    totalTokens: number;
  };
}

/**
 * 工具定义 - 直接兼容 Vercel AI SDK 的 Tool 类型
 */
export type ToolDefinition = import('ai').Tool;

/**
 * 工具集合 - Record<工具名, Tool>
 */
export type ToolSet = Record<string, ToolDefinition>;

/**
 * 流式文本事件
 * 用于消息总线的流式输出事件
 */
export interface StreamTextEvent {
  /** 目标渠道 */
  channel: string;

  /** 聊天标识 */
  chatId: string;

  /** 文本块内容 */
  chunk: string;

  /** 渠道特定的元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 工具提示事件
 * 用于消息总线的工具执行提示事件
 */
export interface ToolHintEvent {
  /** 目标渠道 */
  channel: string;

  /** 聊天标识 */
  chatId: string;

  /** 提示内容 */
  content: string;
}

/**
 * 进度选项
 * 用于 onProgress 回调的额外选项
 */
export interface ProgressOptions {
  /** 工具提示 (是否为工具调用提示) */
  toolHint?: boolean;
}

/**
 * 消息总线接口
 *
 * 供 ChannelManager、渠道等组件使用，解耦具体实现
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

  /** 添加入站消息过滤器 */
  addInboundFilter(filter: (msg: InboundMessage) => boolean): void;
}
