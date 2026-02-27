/**
 * 会话记忆管理
 *
 * 管理工具确认的会话记忆，用于MEDIUM风险工具的快速确认
 */

import type { ApprovalConfig } from '../../config/approval-schema';
import { logger } from '../../utils/logger';

/**
 * 记忆记录
 */
interface MemoryRecord {
  /** 工具名称 */
  toolName: string;
  /** 参数哈希 */
  paramsHash: string;
  /** 渠道 */
  channel: string;
  /** 聊天ID */
  chatId: string;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 会话记忆管理器
 */
export class ApprovalMemory {
  /** 记忆记录 */
  private records: Map<string, MemoryRecord>;

  /** 时间窗口（毫秒） */
  private windowMs: number;

  /** 是否启用日志 */
  private enableLogging: boolean;

  /**
   * 构造函数
   *
   * @param config - 确认配置
   */
  constructor(config: ApprovalConfig) {
    this.records = new Map();
    this.windowMs = config.memoryWindow * 1000;
    this.enableLogging = config.enableLogging;
  }

  /**
   * 生成缓存键
   *
   * @param toolName - 工具名称
   * @param params - 参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 缓存键
   */
  private generateCacheKey(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): string {
    const paramsHash = this.hashParams(params);
    return `${channel}:${chatId}:${toolName}:${paramsHash}`;
  }

  /**
   * 哈希参数（简化版）
   *
   * @param params - 参数
   * @returns 哈希值
   */
  private hashParams(params: Record<string, unknown>): string {
    // 简化参数，只取关键部分
    const simplified = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => {
        const valueStr = JSON.stringify(value);
        // 截断长值以减少哈希差异
        const truncated = valueStr.length > 200 ? `${valueStr.slice(0, 200)}...` : valueStr;
        return `${key}:${truncated}`;
      })
      .join('|');

    // 简单哈希
    let hash = 0;
    for (let i = 0; i < simplified.length; i++) {
      const char = simplified.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 检查是否已批准过（在时间窗口内）
   *
   * @param toolName - 工具名称
   * @param params - 参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否已批准
   */
  hasApproved(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): boolean {
    const key = this.generateCacheKey(toolName, params, channel, chatId);
    const record = this.records.get(key);

    if (!record) {
      return false;
    }

    // 检查时间窗口
    const now = Date.now();
    const ageMs = now - record.timestamp;

    if (ageMs > this.windowMs) {
      // 记录已过期，删除
      this.records.delete(key);
      if (this.enableLogging) {
        logger.debug({ key, ageMs, windowMs: this.windowMs }, 'Approval record expired');
      }
      return false;
    }

    if (this.enableLogging) {
      logger.debug({ key, ageMs, windowMs: this.windowMs }, 'Approval found in memory');
    }

    return true;
  }

  /**
   * 记录批准
   *
   * @param toolName - 工具名称
   * @param params - 参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   */
  recordApproval(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): void {
    const key = this.generateCacheKey(toolName, params, channel, chatId);
    const paramsHash = this.hashParams(params);

    const record: MemoryRecord = {
      toolName,
      paramsHash,
      channel,
      chatId,
      timestamp: Date.now(),
    };

    this.records.set(key, record);

    if (this.enableLogging) {
      logger.info({ key, toolName, channel, chatId }, 'Approval recorded to memory');
    }
  }

  /**
   * 清除指定聊天的所有记录
   *
   * @param chatId - 聊天ID
   */
  clearChat(chatId: string): void {
    const toDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      if (record.chatId === chatId) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.records.delete(key));

    if (this.enableLogging && toDelete.length > 0) {
      logger.info({ chatId, count: toDelete.length }, 'Cleared approval records for chat');
    }
  }

  /**
   * 清除指定渠道的所有记录
   *
   * @param channel - 渠道
   */
  clearChannel(channel: string): void {
    const toDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      if (record.channel === channel) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.records.delete(key));

    if (this.enableLogging && toDelete.length > 0) {
      logger.info({ channel, count: toDelete.length }, 'Cleared approval records for channel');
    }
  }

  /**
   * 清除所有过期记录
   *
   * @returns 清除的记录数
   */
  clearExpired(): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, record] of this.records.entries()) {
      const ageMs = now - record.timestamp;
      if (ageMs > this.windowMs) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => this.records.delete(key));

    if (this.enableLogging && toDelete.length > 0) {
      logger.info({ count: toDelete.length }, 'Cleared expired approval records');
    }

    return toDelete.length;
  }

  /**
   * 清除所有记录
   */
  clearAll(): void {
    const count = this.records.size;
    this.records.clear();

    if (this.enableLogging) {
      logger.info({ count }, 'Cleared all approval records');
    }
  }

  /**
   * 获取记录数量
   *
   * @returns 记录数量
   */
  get size(): number {
    return this.records.size;
  }

  /**
   * 获取所有记录（用于调试）
   *
   * @returns 记录数组
   */
  getAllRecords(): MemoryRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * 获取指定聊天的记录数量
   *
   * @param chatId - 聊天ID
   * @returns 记录数量
   */
  getChatRecordCount(chatId: string): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.chatId === chatId) {
        count++;
      }
    }
    return count;
  }

  /**
   * 获取指定渠道的记录数量
   *
   * @param channel - 渠道
   * @returns 记录数量
   */
  getChannelRecordCount(channel: string): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.channel === channel) {
        count++;
      }
    }
    return count;
  }
}
