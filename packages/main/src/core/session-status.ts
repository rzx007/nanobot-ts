/**
 * 会话状态管理器
 *
 * 跟踪所有会话的运行状态（idle/busy/retry/error）
 * 使用内存 Map 存储，提供实时状态查询
 */

import { EventEmitter } from 'eventemitter3';
import { logger } from '@nanobot/logger';

/**
 * 会话状态类型
 */
export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }
  | { type: 'error'; error: string };

/**
 * 会话状态变更事件
 */
export interface SessionStatusEvent {
  sessionKey: string;
  status: SessionStatus;
}

/**
 * 会话状态事件（供 EventEmitter 订阅）
 */
interface SessionStatusEvents {
  'status-change': (event: SessionStatusEvent) => void;
}

/**
 * 会话状态管理器
 *
 * 负责跟踪和管理所有会话的运行状态
 */
export class SessionStatusManager extends EventEmitter<SessionStatusEvents> {
  /** 状态存储（内存 Map） */
  private readonly state = new Map<string, SessionStatus>();

  /** 默认空闲状态 */
  private static readonly IDLE_STATUS: SessionStatus = { type: 'idle' };

  /**
   * 获取会话状态
   *
   * @param sessionKey - 会话键
   * @returns 会话状态
   */
  get(sessionKey: string): SessionStatus {
    return this.state.get(sessionKey) ?? SessionStatusManager.IDLE_STATUS;
  }

  /**
   * 设置会话状态
   *
   * @param sessionKey - 会话键
   * @param status - 会话状态
   */
  set(sessionKey: string, status: SessionStatus): void {
    const previousStatus = this.get(sessionKey);
    this.state.set(sessionKey, status);

    logger.debug(
      { sessionKey, previous: previousStatus.type, current: status.type },
      'Session status changed',
    );

    // 发布状态变更事件
    this.emit('status-change', { sessionKey, status });
  }

  /**
   * 列出所有会话状态
   *
   * @returns 所有会话状态的副本
   */
  list(): Record<string, SessionStatus> {
    return Object.fromEntries(this.state);
  }

  /**
   * 获取指定状态的会话列表
   *
   * @param statusType - 状态类型
   * @returns 会话键列表
   */
  getByType(statusType: SessionStatus['type']): string[] {
    const result: string[] = [];
    for (const [key, status] of this.state) {
      if (status.type === statusType) {
        result.push(key);
      }
    }
    return result;
  }

  /**
   * 检查会话是否空闲
   *
   * @param sessionKey - 会话键
   * @returns 是否空闲
   */
  isIdle(sessionKey: string): boolean {
    return this.get(sessionKey).type === 'idle';
  }

  /**
   * 检查会话是否忙碌
   *
   * @param sessionKey - 会话键
   * @returns 是否忙碌
   */
  isBusy(sessionKey: string): boolean {
    return this.get(sessionKey).type === 'busy';
  }

  /**
   * 清理会话状态（重置为 idle）
   *
   * @param sessionKey - 会话键
   */
  clear(sessionKey: string): void {
    this.set(sessionKey, SessionStatusManager.IDLE_STATUS);
  }

  /**
   * 删除会话状态
   *
   * @param sessionKey - 会话键
   */
  delete(sessionKey: string): void {
    this.state.delete(sessionKey);
    logger.debug({ sessionKey }, 'Session status deleted');
  }

  /**
   * 清理所有状态
   *
   * 停止时调用，清理内存
   */
  clearAll(): void {
    const count = this.state.size;
    this.state.clear();
    logger.info({ count }, 'All session statuses cleared');
  }

  /**
   * 获取状态统计
   *
   * @returns 状态统计
   */
  getStats(): {
    total: number;
    idle: number;
    busy: number;
    retry: number;
    error: number;
  } {
    const stats = {
      total: this.state.size,
      idle: 0,
      busy: 0,
      retry: 0,
      error: 0,
    };

    for (const status of this.state.values()) {
      stats[status.type]++;
    }

    return stats;
  }
}

/**
 * 单例实例（全局共享）
 */
let globalInstance: SessionStatusManager | null = null;

/**
 * 获取全局会话状态管理器实例
 *
 * @returns 全局实例
 */
export function getSessionStatusManager(): SessionStatusManager {
  if (!globalInstance) {
    globalInstance = new SessionStatusManager();
  }
  return globalInstance;
}

/**
 * 重置全局实例（主要用于测试）
 */
export function resetSessionStatusManager(): void {
  if (globalInstance) {
    globalInstance.clearAll();
    globalInstance.removeAllListeners();
    globalInstance = null;
  }
}
