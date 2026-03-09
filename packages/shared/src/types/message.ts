/**
 * Message 相关类型
 */

export interface SessionMessage {
  /** 角色 (user/assistant/system) */
  role: 'user' | 'assistant' | 'system';

  /** 消息内容 */
  content: string;

  /** 时间戳 */
  timestamp: string;

  /** 工具调用信息 */
  toolCalls?: unknown;

  /** 工具调用 ID */
  toolCallId?: string;

  /** 模型名称 */
  model?: string;
}

export interface Session {
  /** 会话密钥 */
  key: string;

  /** 消息列表 */
  messages: SessionMessage[];

  /** 已整合到长期记忆的消息数量 (用于增量整合) */
  lastConsolidated: number;

  /** 创建时间 */
  createdAt: string;

  /** 更新时间 */
  updatedAt: string;
}
