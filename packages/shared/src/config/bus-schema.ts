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
 * 入站消息
 */
export type InboundMessage = z.infer<typeof InboundMessageSchema>;

/**
 * 出站消息
 */
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;


/**
 * 消息总线接口
 *
 * 供 ChannelManager、渠道、ApprovalManager、QuestionManager 等组件使用，解耦具体实现。
 * 入站/出站消息为队列语义；流式部分、完成、工具提示、审批、提问为事件广播语义。
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
  getStatus(): {
    inboundQueueLength: number;
    outboundQueueLength: number;
    inboundConsumersLength: number;
    outboundConsumersLength: number;
  };
}
