/**
 * 事件类型定义
 *
 * 定义消息总线中使用的所有事件类型
 * ToolDefinition 直接兼容 Vercel AI SDK 的 Tool 类型
 */

import type { Tool } from 'ai';

/**
 * 入站消息 - 从聊天渠道接收到的消息
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
 * 获取入站消息的会话密钥
 */
export function getSessionKey(msg: Pick<InboundMessage, 'channel' | 'chatId' | 'sessionKeyOverride'>): string {
  return msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
}

/**
 * 出站消息 - 要发送到聊天渠道的消息
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
 * 可直接传入 generateText/streamText 的 tools 参数
 */
export type ToolDefinition = Tool;

/**
 * 工具集合 - Record<工具名, Tool>
 * 即 generateText({ tools }) 的 tools 参数类型
 */
export type ToolSet = Record<string, ToolDefinition>;

/**
 * 进度选项
 * 用于 onProgress 回调的额外选项
 */
export interface ProgressOptions {
  /** 工具提示 (是否为工具调用提示) */
  toolHint?: boolean;
}
