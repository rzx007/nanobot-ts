/**
 * 会话管理器
 * 
 * 管理对话会话的存储和检索
 */

import fs from 'fs/promises';
import path from 'path';
import { expandHome, ensureDir, safeFilename } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * 会话消息
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
}

/**
 * 会话
 */
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

  /** 元数据 */
  metadata: Record<string, unknown>;
}

/**
 * 会话管理器
 * 
 * 负责会话的存储、加载和删除
 */
export class SessionManager {
  /** 会话目录路径 */
  private readonly sessionsDir: string;

  /** 会话缓存 */
  private readonly cache = new Map<string, Session>();

  /**
   * 构造函数
   * 
   * @param workspace - 工作区路径
   */
  constructor(workspace: string) {
    this.sessionsDir = path.join(expandHome(workspace), 'sessions');
  }

  /**
   * 初始化
   * 
   * 创建必要的目录
   */
  async init(): Promise<void> {
    await ensureDir(this.sessionsDir);
    logger.info(`Session manager initialized: ${this.sessionsDir}`);
  }

  /**
   * 清除缓存
   * 
   * @param key - 会话密钥
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 获取或创建会话
   * 
   * @param key - 会话密钥
   * @returns 会话对象
   */
  async getOrCreate(key: string): Promise<Session> {
    // 检查缓存
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    // 尝试加载
    let session = await this.load(key);
    if (!session) {
      // 创建新会话
      session = {
        key,
        messages: [],
        lastConsolidated: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {},
      };
      await this.save(session);
      logger.info(`Created new session: ${key}`);
    }

    // 缓存会话
    this.cache.set(key, session);
    return session;
  }

  /**
   * 添加消息到会话
   * 
   * @param key - 会话密钥
   * @param message - 消息对象
   */
  async addMessage(key: string, message: SessionMessage): Promise<void> {
    const session = await this.getOrCreate(key);
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    await this.save(session);
  }

  /**
   * 获取会话历史 (用于 LLM 上下文)
   * 从 lastConsolidated 之后的消息开始，避免重复传递已归档内容
   *
   * @param key - 会话密钥
   * @param maxMessages - 最大消息数
   * @returns 消息列表
   */
  async getHistory(
    key: string,
    maxMessages: number = 100
  ): Promise<Array<{ role: string; content: string }>> {
    const session = await this.getOrCreate(key);
    const lastConsolidated = session.lastConsolidated ?? 0;

    // 从未整合部分开始
    const unconsolidated = session.messages.slice(lastConsolidated);

    // 过滤并转换，跳过孤儿 tool 消息
    const out: Array<{ role: string; content: string }> = [];
    for (const msg of unconsolidated) {
      if (msg.toolCalls || msg.toolCallId) continue;
      out.push({ role: msg.role, content: msg.content ?? '' });
    }

    return out.slice(-maxMessages);
  }

  /**
   * 清除会话历史
   * 
   * @param key - 会话密钥
   */
  async clear(key: string): Promise<void> {
    const session = await this.getOrCreate(key);
    session.messages = [];
    session.lastConsolidated = 0;
    session.updatedAt = new Date().toISOString();
    await this.save(session);
    this.invalidate(key);
    logger.info(`Cleared session history: ${key}`);
  }

  /**
   * 删除会话
   * 
   * @param key - 会话密钥
   */
  async deleteSession(key: string): Promise<void> {
    const filepath = this.getSessionPath(key);

    // 删除文件
    try {
      await fs.unlink(filepath);
      logger.info(`Deleted session: ${key}`);
    } catch (err) {
      logger.error({ err }, `Failed to delete session: ${key}`);
    }

    // 清除缓存
    this.cache.delete(key);
  }

  /**
   * 列出所有会话
   * 
   * @returns 会话信息列表
   */
  async listSessions(): Promise<
    Array<{ key: string; messageCount: number; updatedAt: string }>
  > {
    const files = await fs.readdir(this.sessionsDir);
    const sessions: Array<{
      key: string;
      messageCount: number;
      updatedAt: string;
    }> = [];

    for (const filename of files) {
      if (!filename.endsWith('.jsonl')) {
        continue;
      }

      const fileKey = filename.slice(0, -6); // 移除 .jsonl
      const session = await this.load(fileKey);
      if (session) {
        sessions.push({
          key: session.key, // 使用 session 对象中的原始 key
          messageCount: session.messages.length,
          updatedAt: session.updatedAt,
        });
      }
    }

    // 按更新时间排序
    return sessions.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * 显式保存会话 (供 Memory 等更新 lastConsolidated 后调用)
   */
  async saveSession(session: Session): Promise<void> {
    await this.save(session);
  }

  /**
   * 保存会话
   * 
   * @param session - 会话对象
   */
  private async save(session: Session): Promise<void> {
    const filepath = this.getSessionPath(session.key);
    const data = JSON.stringify(session);

    await fs.writeFile(filepath, data, 'utf-8');
  }

  /**
   * 加载会话
   * 
   * @param key - 会话密钥
   * @returns 会话对象或 null
   */
  private async load(key: string): Promise<Session | null> {
    const filepath = this.getSessionPath(key);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      const session = JSON.parse(data) as Session;
      if (typeof session.lastConsolidated !== 'number') {
        session.lastConsolidated = 0;
      }
      return session;
    } catch (err) {
      logger.error({ err }, `Failed to load session: ${key}`);
      return null;
    }
  }

  /**
   * 获取会话文件路径
   * 
   * @param key - 会话密钥
   * @returns 文件路径
   */
  private getSessionPath(key: string): string {
    const safeKey = safeFilename(key.replace(':', '_'));
    return path.join(this.sessionsDir, `${safeKey}.jsonl`);
  }
}
