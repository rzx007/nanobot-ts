/**
 * Drizzle ORM 会话管理器
 *
 * 使用 bun:sqlite 存储会话数据，支持多维度查询
 */

import path from 'path';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, and, desc, gt, sql, count } from 'drizzle-orm';
import * as schema from './schema/schema';
import type { Session as SharedSession, SessionMessage as SharedSessionMessage, SessionMetadata } from '@nanobot/shared';
import { logger } from '@nanobot/logger';
import { ensureDir } from '@nanobot/utils';

/**
 * 会话信息（用于列表查询）
 */
export interface SessionInfo {
  key: string;
  channel?: string;
  chatId?: string;
  messageCount: number;
  lastMessageAt?: string | null;
  updatedAt: string;
  metadata?: SessionMetadata;
}

/**
 * 渠道统计信息
 */
export interface ChannelStats {
  channel: string;
  sessionCount: number;
  messageCount: number;
}

/**
 * Drizzle 会话管理器
 */
export class DrizzleSessionManager {
  private db: ReturnType<typeof drizzle>;
  private readonly sessionsDir: string;

  /** 会话缓存 */
  private readonly cache = new Map<string, SharedSession>();

  constructor(workspace: string) {
    this.sessionsDir = path.resolve(workspace);

    // 确保数据库目录存在
    ensureDir(this.sessionsDir);

    // 初始化数据库连接
    const dbPath = path.join(this.sessionsDir, 'sessions.db');
    const sqlite = new Database(dbPath);
    sqlite.exec('PRAGMA journal_mode = WAL;');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    this.db = drizzle(sqlite, { schema });
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    // 创建表结构
    await this.createTables();
    logger.info(`Drizzle session manager initialized: ${this.sessionsDir}`);
  }

  /**
   * 创建数据库表
   */
  private async createTables(): Promise<void> {
    // 创建 sessions 表
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        key TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        last_consolidated INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建 session_messages 表
    await this.db.run(sql`
      CREATE TABLE IF NOT EXISTS session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_key TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        message_id TEXT UNIQUE,
        parts TEXT,
        metadata TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        model TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_key) REFERENCES sessions(key) ON DELETE CASCADE
      )
    `);

    // 创建索引
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS sessions_channel_idx ON sessions(channel)`);
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS sessions_chat_id_idx ON sessions(chat_id)`);
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS sessions_channel_chat_id_idx ON sessions(channel, chat_id)`);
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS sessions_updated_at_idx ON sessions(updated_at)`);

    await this.db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_session_key_idx ON session_messages(session_key)`);
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_timestamp_idx ON session_messages(timestamp)`);
    await this.db.run(sql`CREATE INDEX IF NOT EXISTS session_messages_session_key_timestamp_idx ON session_messages(session_key, timestamp)`);
  }

  /**
   * 清除缓存
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 获取或创建会话（通过 sessionKey）
   */
  async getOrCreate(key: string): Promise<SharedSession> {
    // 检查缓存
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 尝试从数据库加载
    let result = await this.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.key, key))
      .get();

    if (!result) {
      // 从 key 中解析 channel 和 chatId（格式：channel:chatId）
      const [channel, chatId] = this.parseSessionKey(key);

      // 创建新会话
      const newSession = {
        key,
        channel,
        chatId,
        lastConsolidated: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // 元数据字段
        name: null,
        title: null,
        tags: '[]',
        archived: 0,
        archivedAt: null,
        model: null,
        messageCount: 0,
        lastActiveAt: new Date().toISOString(),
        pinned: 0,
      };

      await this.db.insert(schema.sessions).values(newSession);
      result = newSession;

      logger.info(`Created new session: ${key}`);
    }

    // 加载消息
    const messages = await this.db
      .select()
      .from(schema.sessionMessages)
      .where(eq(schema.sessionMessages.sessionKey, key))
      .orderBy(schema.sessionMessages.timestamp)
      .all();

    // 解析元数据
    const metadata: SessionMetadata = {
      name: result.name || undefined,
      title: result.title || undefined,
      tags: result.tags ? JSON.parse(result.tags) : [],
      archived: Boolean(result.archived),
      archivedAt: result.archivedAt || undefined,
      model: result.model || undefined,
      messageCount: result.messageCount || 0,
      channel: result.channel || undefined,
      chatId: result.chatId || undefined,
      lastActiveAt: result.lastActiveAt || result.updatedAt,
      pinned: Boolean(result.pinned),
    };

    const session: SharedSession = {
      key: result.key,
      messages: messages.map(this.deserializeMessage),
      lastConsolidated: result.lastConsolidated,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      metadata,
    };

    // 缓存会话
    this.cache.set(key, session);
    return session;
  }

  /**
   * 添加消息到会话
   */
  async addMessage(key: string, message: SharedSessionMessage): Promise<void> {
    // 确保 session 存在（避免外键约束错误）
    await this.getOrCreate(key);

    await this.db.transaction(async (tx) => {
      // 插入消息
      await tx.insert(schema.sessionMessages).values({
        sessionKey: key,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        messageId: message.id || null,
        parts: message.parts ? JSON.stringify(message.parts) : null,
        metadata: message.metadata ? JSON.stringify(message.metadata) : null,
        toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        toolCallId: message.toolCallId || null,
        model: message.model || null,
      });

      // 更新会话时间戳和消息计数
      const now = new Date().toISOString();
      await tx.update(schema.sessions)
        .set({
          updatedAt: now,
          lastActiveAt: now,
          messageCount: sql`message_count + 1`,
        })
        .where(eq(schema.sessions.key, key));
    });

    // 清除缓存
    this.invalidate(key);
  }

  /**
   * 获取会话历史（用于 LLM 上下文）
   */
  async getHistory(
    key: string,
    maxMessages = 100
  ): Promise<Array<{ role: string; content: string; [x: string]: unknown }>> {
    const session = await this.getOrCreate(key);
    const lastConsolidated = session.lastConsolidated ?? 0;

    // 从未整合部分开始
    const unconsolidated = session.messages.slice(lastConsolidated);

    // 过滤并转换，跳过工具消息
    const out: Array<{ role: string; content: string; [x: string]: unknown }> = [];
    for (const msg of unconsolidated) {
      if (msg.toolCalls || msg.toolCallId) continue;
      out.push({
        role: msg.role,
        content: msg.content,
        parts: msg.parts ?? [],
        metadata: msg.metadata ?? {}
      });
    }

    return out.slice(-maxMessages);
  }

  /**
   * 清除会话历史
   */
  async clear(key: string): Promise<void> {
    // 确保 session 存在
    await this.getOrCreate(key);

    // 删除所有消息
    await this.db
      .delete(schema.sessionMessages)
      .where(eq(schema.sessionMessages.sessionKey, key));

    // 重置会话状态
    await this.db
      .update(schema.sessions)
      .set({
        lastConsolidated: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.sessions.key, key));

    this.invalidate(key);
    logger.info(`Cleared session history: ${key}`);
  }

  /**
   * 删除会话
   */
  async deleteSession(key: string): Promise<void> {
    try {
      // 级联删除会话和消息
      await this.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.key, key));

      this.cache.delete(key);
      logger.info(`Deleted session: ${key}`);
    } catch (err) {
      logger.error({ err }, `Failed to delete session: ${key}`);
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<Array<{
    key: string;
    messageCount: number;
    updatedAt: string;
  }>> {
    const results = await this.db
      .select({
        key: schema.sessions.key,
        messageCount: count(schema.sessionMessages.id).mapWith(Number),
        updatedAt: schema.sessions.updatedAt,
      })
      .from(schema.sessions)
      .leftJoin(schema.sessionMessages, eq(schema.sessions.key, schema.sessionMessages.sessionKey))
      .groupBy(schema.sessions.key)
      .orderBy(desc(schema.sessions.updatedAt))
      .all();

    return results.map(r => ({
      key: r.key,
      messageCount: r.messageCount,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * 【新增】按渠道列出所有会话
   */
  async listSessionsByChannel(channel: string): Promise<SessionInfo[]> {
    const results = await this.db
      .select({
        key: schema.sessions.key,
        chatId: schema.sessions.chatId,
        messageCount: count(schema.sessionMessages.id).mapWith(Number),
        lastMessageAt: sql<string>`max(${schema.sessionMessages.timestamp})`,
        updatedAt: schema.sessions.updatedAt,
      })
      .from(schema.sessions)
      .leftJoin(schema.sessionMessages, eq(schema.sessions.key, schema.sessionMessages.sessionKey))
      .where(eq(schema.sessions.channel, channel))
      .groupBy(schema.sessions.key)
      .orderBy(desc(schema.sessions.updatedAt))
      .all();

    return results.map(r => ({
      key: r.key,
      channel,
      chatId: r.chatId,
      messageCount: r.messageCount,
      lastMessageAt: r.lastMessageAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * 【新增】按渠道和 chatId 查询会话
   */
  async getOrCreateByChannel(
    channel: string,
    chatId: string
  ): Promise<SharedSession> {
    const key = `${channel}:${chatId}`;
    return this.getOrCreate(key);
  }

  /**
   * 【新增】获取各渠道统计信息
   */
  async getChannelStats(): Promise<ChannelStats[]> {
    const results = await this.db
      .select({
        channel: schema.sessions.channel,
        sessionCount: sql<number>`count(distinct ${schema.sessions.key})`.mapWith(Number),
        messageCount: count(schema.sessionMessages.id).mapWith(Number),
      })
      .from(schema.sessions)
      .leftJoin(schema.sessionMessages, eq(schema.sessions.key, schema.sessionMessages.sessionKey))
      .groupBy(schema.sessions.channel)
      .all();

    return results;
  }

  /**
   * 显式保存会话（供 Memory 等更新 lastConsolidated 后调用）
   */
  async saveSession(session: SharedSession): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({
        lastConsolidated: session.lastConsolidated,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.sessions.key, session.key));

    this.invalidate(session.key);
  }

  /**
   * 解析 sessionKey
   * 格式：channel:chatId 或 channel:chatId:extra
   */
  private parseSessionKey(key: string): [string, string] {
    const parts = key.split(':');
    if (parts.length >= 2) {
      const channel = parts[0] || 'unknown';
      const chatId = parts.slice(1).join(':') || key;
      return [channel, chatId];
    }
    return ['unknown', key];
  }

  /**
   * 反序列化消息（从数据库）
   */
  private deserializeMessage(row: typeof schema.sessionMessages.$inferSelect): SharedSessionMessage {
    return {
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      id: row.messageId || undefined,
      parts: row.parts ? JSON.parse(row.parts) : undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined,
      toolCallId: row.toolCallId || undefined,
      model: row.model || undefined,
    };
  }

  /**
   * 更新会话元数据
   *
   * @param key - 会话键
   * @param metadata - 元数据
   */
  async updateMetadata(key: string, metadata: Partial<SessionMetadata>): Promise<void> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (metadata.name !== undefined) {
      updateData.name = metadata.name;
    }
    if (metadata.title !== undefined) {
      updateData.title = metadata.title;
    }
    if (metadata.tags !== undefined) {
      updateData.tags = JSON.stringify(metadata.tags);
    }
    if (metadata.archived !== undefined) {
      updateData.archived = Number(metadata.archived);
      updateData.archivedAt = metadata.archived ? new Date().toISOString() : null;
    }
    if (metadata.model !== undefined) {
      updateData.model = metadata.model;
    }
    if (metadata.pinned !== undefined) {
      updateData.pinned = Number(metadata.pinned);
    }

    await this.db
      .update(schema.sessions)
      .set(updateData)
      .where(eq(schema.sessions.key, key));

    this.invalidate(key);
    logger.debug({ key, metadata }, 'Session metadata updated');
  }

  /**
   * 设置会话标题
   *
   * @param key - 会话键
   * @param title - 标题
   */
  async setTitle(key: string, title: string): Promise<void> {
    await this.updateMetadata(key, { title });
  }

  /**
   * 设置会话名称
   *
   * @param key - 会话键
   * @param name - 名称
   */
  async setName(key: string, name: string): Promise<void> {
    await this.updateMetadata(key, { name });
  }

  /**
   * 更新会话标签
   *
   * @param key - 会话键
   * @param tags - 标签列表
   */
  async setTags(key: string, tags: string[]): Promise<void> {
    await this.updateMetadata(key, { tags });
  }

  /**
   * 归档会话
   *
   * @param key - 会话键
   * @param archived - 是否归档
   */
  async setArchived(key: string, archived: boolean): Promise<void> {
    await this.updateMetadata(key, { archived });
  }

  /**
   * 置顶会话
   *
   * @param key - 会话键
   * @param pinned - 是否置顶
   */
  async setPinned(key: string, pinned: boolean): Promise<void> {
    await this.updateMetadata(key, { pinned });
  }

  /**
   * 搜索会话
   *
   * @param options - 搜索选项
   * @returns 会话列表
   */
  async searchSessions(options: {
    query?: string;
    channel?: string;
    archived?: boolean;
    limit?: number;
  }): Promise<SessionInfo[]> {
    const conditions = [];

    if (options.channel) {
      conditions.push(eq(schema.sessions.channel, options.channel));
    }

    if (options.archived !== undefined) {
      if (options.archived) {
        conditions.push(sql`${schema.sessions.archived} = 1`);
      } else {
        conditions.push(sql`${schema.sessions.archived} = 0`);
      }
    }

    if (options.query) {
      const searchTerm = `%${options.query}%`;
      conditions.push(
        sql`(${schema.sessions.title} LIKE ${searchTerm} OR ${schema.sessions.name} LIKE ${searchTerm})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db
      .select({
        key: schema.sessions.key,
        channel: schema.sessions.channel,
        chatId: schema.sessions.chatId,
        messageCount: count(schema.sessionMessages.id).mapWith(Number),
        lastMessageAt: sql<string>`max(${schema.sessionMessages.timestamp})`,
        updatedAt: schema.sessions.updatedAt,
        name: schema.sessions.name,
        title: schema.sessions.title,
        tags: schema.sessions.tags,
        archived: schema.sessions.archived,
        pinned: schema.sessions.pinned,
        lastActiveAt: schema.sessions.lastActiveAt,
      })
      .from(schema.sessions)
      .leftJoin(schema.sessionMessages, eq(schema.sessions.key, schema.sessionMessages.sessionKey))
      .where(whereClause)
      .groupBy(schema.sessions.key)
      .orderBy(
        desc(schema.sessions.pinned),
        desc(schema.sessions.lastActiveAt),
      )
      .limit(options.limit || 50)
      .all();

    return results.map((r) => ({
      key: r.key,
      channel: r.channel || undefined,
      chatId: r.chatId || undefined,
      messageCount: r.messageCount,
      lastMessageAt: r.lastMessageAt,
      updatedAt: r.updatedAt,
      metadata: {
        name: r.name || undefined,
        title: r.title || undefined,
        tags: r.tags ? JSON.parse(r.tags) : [],
        archived: Boolean(r.archived),
        archivedAt: undefined,
        model: undefined,
        messageCount: r.messageCount,
        channel: r.channel || undefined,
        chatId: r.chatId || undefined,
        lastActiveAt: r.lastActiveAt || r.updatedAt,
        pinned: Boolean(r.pinned),
      },
    }));
  }

  /**
   * 获取活跃会话
   *
   * @param days - 最近活跃天数（默认 7 天）
   * @returns 会话列表
   */
  async getActiveSessions(days: number = 7): Promise<SessionInfo[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const results = await this.db
      .select({
        key: schema.sessions.key,
        channel: schema.sessions.channel,
        chatId: schema.sessions.chatId,
        messageCount: count(schema.sessionMessages.id).mapWith(Number),
        lastMessageAt: sql<string>`max(${schema.sessionMessages.timestamp})`,
        updatedAt: schema.sessions.updatedAt,
        lastActiveAt: schema.sessions.lastActiveAt,
        pinned: schema.sessions.pinned,
      })
      .from(schema.sessions)
      .leftJoin(schema.sessionMessages, eq(schema.sessions.key, schema.sessionMessages.sessionKey))
      .where(
        and(
          eq(schema.sessions.archived, 0),
          gt(schema.sessions.lastActiveAt, cutoffDate.toISOString()),
        ),
      )
      .groupBy(schema.sessions.key)
      .orderBy(desc(schema.sessions.pinned), desc(schema.sessions.lastActiveAt))
      .all();

    return results.map((r) => ({
      key: r.key,
      channel: r.channel || undefined,
      chatId: r.chatId || undefined,
      messageCount: r.messageCount,
      lastMessageAt: r.lastMessageAt,
      updatedAt: r.updatedAt,
      metadata: {
        name: undefined,
        title: undefined,
        tags: [],
        archived: false,
        messageCount: r.messageCount,
        channel: r.channel || undefined,
        chatId: r.chatId || undefined,
        lastActiveAt: r.lastActiveAt || r.updatedAt,
        pinned: Boolean(r.pinned),
      },
    }));
  }
}
