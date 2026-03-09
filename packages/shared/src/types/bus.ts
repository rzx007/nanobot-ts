/**
 * Bus 相关类型
 */

import type { ToolCall } from './tool';

export * from './tool';

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

export function getSessionKey(
  msg: Pick<InboundMessage, 'channel' | 'chatId' | 'sessionKeyOverride'>,
): string {
  return msg.sessionKeyOverride ?? `${msg.channel}:${msg.chatId}`;
}

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

export interface LLMResponse {
  /** 响应内容 (文本) */
  content: string;

  /** 是否有工具调用 */
  hasToolCalls: boolean;

  /** 工具调用列表 */
  toolCalls: ToolCall[];

  /** 使用统计 (可选) */
  usage?: {
    /** 输入 Token 数 */
    inputTokens?: number;

    /** 输出 Token 数 */
    outputTokens?: number;

    /** 总 Token 数 */
    totalTokens?: number;
  };
}

export interface StreamTextEvent {
  /** 事件类型 */
  type: 'text-delta' | 'finish';

  /** 文本增量 (type: text-delta 时) */
  textDelta?: string;

  /** 完成原因 (type: finish 时) */
  finishReason?: string;

  /** 工具调用列表 (type: finish 时) */
  toolCalls?: ToolCall[];
}

export interface ToolHintEvent {
  /** 事件类型 */
  type: 'tool-start' | 'tool-finish';

  /** 工具名称 */
  toolName: string;

  /** 工具调用 ID */
  toolCallId: string;

  /** 工具参数 (type: tool-start 时) */
  arguments?: Record<string, unknown>;

  /** 工具结果 (type: tool-finish 时) */
  result?: string;
}
