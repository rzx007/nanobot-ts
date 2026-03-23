/**
 * Drizzle ORM Schema for Session Management
 *
 * 使用 bun:sqlite 存储会话数据，支持多维度查询
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { SessionMessage } from '@nanobot/shared';

/**
 * 会话表
 * 存储会话元数据，支持多维度查询
 */
export const sessions = sqliteTable('sessions', {
  // 主键：保持 sessionKey 的唯一性，向后兼容现有 API
  key: text('key').primaryKey(),

  // 渠道信息（支持多维度查询）
  channel: text('channel').notNull(), // 'cli', 'telegram', 'discord', 'web' 等
  chatId: text('chat_id').notNull(),  // 具体聊天 ID

  // 会话状态
  lastConsolidated: integer('last_consolidated').notNull().default(0),

  // 时间戳
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  // 按渠道查询的索引
  channelIdx: index('sessions_channel_idx').on(table.channel),

  // 按聊天 ID 查询的索引
  chatIdIdx: index('sessions_chat_id_idx').on(table.chatId),

  // 组合查询索引（channel + chatId）
  channelChatIdIdx: index('sessions_channel_chat_id_idx').on(table.channel, table.chatId),

  // 按更新时间查询的索引（用于排序）
  updatedAtIdx: index('sessions_updated_at_idx').on(table.updatedAt),
}));

/**
 * 会话消息表
 * 一对多关系：一个 session 包含多条消息
 */
export const sessionMessages = sqliteTable('session_messages', {
  // 主键
  id: integer('id').primaryKey({ autoIncrement: true }),

  // 外键关联
  sessionKey: text('session_key').notNull().references(() => sessions.key, {
    onDelete: 'cascade' // 级联删除：删除 session 时自动删除消息
  }),

  // 消息内容
  role: text('role').notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text('content').notNull().default(''),

  // UIMessage id（可选）
  messageId: text('message_id').unique(),

  // JSON 字段（序列化存储）
  parts: text('parts'),        // UIMessagePart[] | null
  metadata: text('metadata'),  // Record<string, unknown> | null

  // 工具调用相关（废弃字段保留向后兼容）
  toolCalls: text('tool_calls'),      // ToolCall[] | null
  toolCallId: text('tool_call_id'),   // string | null

  // 其他信息
  model: text('model'),       // 使用的模型名称
  timestamp: text('timestamp').notNull(),
}, (table) => ({
  // 按会话查询的索引
  sessionKeyIdx: index('session_messages_session_key_idx').on(table.sessionKey),

  // 按时间戳查询的索引（用于排序）
  timestampIdx: index('session_messages_timestamp_idx').on(table.timestamp),

  // 组合索引：sessionKey + timestamp（用于获取会话历史并排序）
  sessionKeyTimestampIdx: index('session_messages_session_key_timestamp_idx')
    .on(table.sessionKey, table.timestamp),
}));

// 导出类型
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionMessageRow = typeof sessionMessages.$inferSelect;
export type NewSessionMessageRow = typeof sessionMessages.$inferInsert;
