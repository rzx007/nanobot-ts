import { z } from 'zod';
import { ToolCallSchema } from './tool-schema';

/**
 * 会话元数据
 */
export const SessionMetadataSchema = z.object({
  /** 用户自定义名称 */
  name: z.string().optional(),

  /** 自动生成的标题 */
  title: z.string().optional(),

  /** 标签列表 */
  tags: z.array(z.string()).default([]),

  /** 是否归档 */
  archived: z.boolean().default(false),

  /** 归档时间 */
  archivedAt: z.string().optional(),

  /** 使用的模型 */
  model: z.string().optional(),

  /** 消息总数 */
  messageCount: z.number().default(0),

  /** 所属渠道 */
  channel: z.string().optional(),

  /** 所属会话 ID */
  chatId: z.string().optional(),

  /** 最后活跃时间 */
  lastActiveAt: z.string().optional(),

  /** 是否置顶 */
  pinned: z.boolean().default(false),
});

/**
 * 默认会话元数据
 */
export const defaultSessionMetadata = {
  tags: [],
  archived: false,
  messageCount: 0,
  pinned: false,
};

export const SessionMessageSchema = z.object({
    /** 角色 (user/assistant/system) */
    role: z.enum(['user', 'assistant', 'system']),

    /** 消息内容 (向后兼容，新版本优先使用 parts) */
    content: z.string(),

    /** 时间戳 */
    timestamp: z.string(),

    /** 消息唯一标识 (UIMessage id) */
    id: z.string().optional(),

    /** 完整的消息 parts (UIMessagePart[]) */
    parts: z.array(z.record(z.string(), z.any())).optional(),

    /** 消息元数据 */
    metadata: z.any().optional(),

    /** 工具调用信息 (废弃，保留向后兼容) */
    toolCalls: z.array(ToolCallSchema).optional(),

    /** 工具调用 ID (废弃，保留向后兼容) */
    toolCallId: z.string().optional(),

    /** 模型名称 */
    model: z.string().optional(),
});

export const SessionSchema = z.object({
    /** 会话密钥 */
    key: z.string(),

    /** 消息列表 */
    messages: z.array(SessionMessageSchema),

    /** 已整合到长期记忆的消息数量 (用于增量整合) */
    lastConsolidated: z.number(),

    /** 创建时间 */
    createdAt: z.string(),

    /** 更新时间 */
    updatedAt: z.string(),

    /** 会话元数据 */
    metadata: SessionMetadataSchema.optional(),
});

export type SessionMessage = z.infer<typeof SessionMessageSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;