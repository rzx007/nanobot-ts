/**
 * 并发会话管理器
 *
 * 管理多个 SessionProcessor 实例，实现会话级别的并发控制
 * 同一会话的消息串行处理，不同会话的消息可以并行处理
 */

import type { InboundMessage, OutboundMessage, Config } from '@nanobot/shared';
import { logger } from '@nanobot/logger';
import type { SessionProcessor } from './session-processor';
import type { SessionOrchestrator } from './agent/session-orchestrator';
import type { StreamBridge } from './agent/stream-bridge';
import type { ToolRuntime } from './agent/tool-runtime';
import { getSessionStatusManager } from './session-status';

/**
 * 会话处理状态
 */
interface SessionProcessingState {
  /** 取消控制器 */
  abort: AbortController;

  /** 回调队列（等待当前消息处理完成） */
  callbacks: Array<{
    resolve: (result: OutboundMessage | null) => void;
    reject: (error: any) => void;
  }>;

  /** 处理器实例 */
  processor?: SessionProcessor;
}

/**
 * 并发会话管理器配置
 */
export interface ConcurrentSessionManagerOptions {
  /** 会话协调器 */
  sessionOrchestrator: SessionOrchestrator;

  /** 流式桥接器 */
  streamBridge: StreamBridge;

  /** 工具运行时 */
  toolRuntime: ToolRuntime;

  /** 配置 */
  config: Config;
}

/**
 * 并发会话管理器
 *
 * 管理多个会话的并发处理
 */
export class ConcurrentSessionManager {
  private readonly sessionOrchestrator: SessionOrchestrator;
  private readonly streamBridge: StreamBridge;
  private readonly toolRuntime: ToolRuntime;
  private readonly config: Config;

  /** 活跃的会话处理器 */
  private readonly processors = new Map<string, SessionProcessor>();

  /** 会话处理状态 */
  private readonly sessionStates = new Map<string, SessionProcessingState>();

  /** 会话状态管理器 */
  private readonly sessionStatusManager = getSessionStatusManager();

  /**
   * 构造函数
   *
   * @param options - 配置选项
   */
  constructor(options: ConcurrentSessionManagerOptions) {
    this.sessionOrchestrator = options.sessionOrchestrator;
    this.streamBridge = options.streamBridge;
    this.toolRuntime = options.toolRuntime;
    this.config = options.config;

    logger.info('ConcurrentSessionManager initialized');
  }

  /**
   * 开始会话处理
   *
   * 如果会话尚未开始，创建新的处理器
   *
   * @param sessionKey - 会话键
   * @param channel - 渠道
   * @param chatId - 会话 ID
   * @returns 处理器实例
   */
  async start(sessionKey: string, channel: string, chatId: string): Promise<SessionProcessor> {
    // 检查是否已存在处理器
    const existing = this.processors.get(sessionKey);
    if (existing) {
      logger.debug({ sessionKey }, 'Session processor already exists');
      return existing;
    }

    // 创建新的处理器
    const processor = this.createProcessor(sessionKey, channel, chatId);
    this.processors.set(sessionKey, processor);

    // 初始化会话状态
    if (!this.sessionStates.has(sessionKey)) {
      this.sessionStates.set(sessionKey, {
        abort: new AbortController(),
        callbacks: [],
        processor,
      });
    }

    logger.info(
      { sessionKey, channel, chatId, activeCount: this.processors.size },
      'Session processor started',
    );

    return processor;
  }

  /**
   * 处理消息
   *
   * 如果会话正在处理其他消息，将消息加入回调队列
   *
   * @param sessionKey - 会话键
   * @param message - 入站消息
   * @returns 出站消息或 null
   */
  async process(sessionKey: string, message: InboundMessage): Promise<OutboundMessage | null> {
    // 确保会话已启动
    let processor = this.processors.get(sessionKey);
    if (!processor) {
      processor = await this.start(sessionKey, message.channel, message.chatId);
    }

    // 获取或创建会话状态
    let state = this.sessionStates.get(sessionKey);
    if (!state) {
      state = {
        abort: new AbortController(),
        callbacks: [],
        processor,
      };
      this.sessionStates.set(sessionKey, state);
    }

    // 检查是否正在处理
    if (!this.sessionStatusManager.isIdle(sessionKey)) {
      logger.debug(
        { sessionKey, queueLength: state.callbacks.length },
        'Session busy, adding to callback queue',
      );

      // 添加到回调队列
      return new Promise((resolve, reject) => {
        state!.callbacks.push({ resolve, reject });
      });
    }

    // 开始处理
    try {
      logger.debug({ sessionKey }, 'Starting message processing');
      const result = await processor.processMessage(message);

      // 触发回调队列
      if (state.callbacks.length > 0) {
        logger.debug(
          { sessionKey, callbackCount: state.callbacks.length },
          'Processing callback queue',
        );

        // 复制回调队列以避免在迭代时修改
        const callbacks = [...state.callbacks];
        state.callbacks = [];

        for (const callback of callbacks) {
          try {
            callback.resolve(result);
          } catch (err) {
            logger.error({ err }, 'Callback queue error');
            callback.reject(err);
          }
        }
      }

      return result;
    } catch (error) {
      // 触发回调队列（传递错误）
      if (state.callbacks.length > 0) {
        logger.debug(
          { sessionKey, callbackCount: state.callbacks.length },
          'Rejecting callback queue due to error',
        );

        const callbacks = [...state.callbacks];
        state.callbacks = [];

        for (const callback of callbacks) {
          callback.reject(error);
        }
      }

      throw error;
    }
  }

  /**
   * 取消会话
   *
   * 取消正在进行的处理，并清空回调队列
   *
   * @param sessionKey - 会话键
   */
  cancel(sessionKey: string): void {
    // 取消处理器
    const processor = this.processors.get(sessionKey);
    if (processor) {
      logger.info({ sessionKey }, 'Cancelling session processor');
      processor.abort();
    }

    // 取消会话状态
    const state = this.sessionStates.get(sessionKey);
    if (state) {
      state.abort.abort();

      // 拒绝所有等待的回调
      for (const callback of state.callbacks) {
        callback.reject(new Error('Session cancelled'));
      }
      state.callbacks = [];

      logger.debug({ sessionKey }, 'Session state cancelled');
    }

    // 清理会话状态
    this.sessionStatusManager.delete(sessionKey);
  }

  /**
   * 获取所有活跃的会话
   *
   * @returns 会话键列表
   */
  getActiveSessions(): string[] {
    return Array.from(this.processors.keys());
  }

  /**
   * 获取会话处理器
   *
   * @param sessionKey - 会话键
   * @returns 处理器实例或 undefined
   */
  getProcessor(sessionKey: string): SessionProcessor | undefined {
    return this.processors.get(sessionKey);
  }

  /**
   * 清理所有会话
   *
   * 停止时调用，清理所有资源
   */
  clearAll(): void {
    const count = this.processors.size;
    logger.info({ count }, 'Clearing all sessions');

    // 取消所有会话
    for (const sessionKey of this.processors.keys()) {
      this.cancel(sessionKey);
    }

    // 清理映射
    this.processors.clear();
    this.sessionStates.clear();

    logger.info('All sessions cleared');
  }

  /**
   * 获取统计信息
   *
   * @returns 统计信息
   */
  getStats(): {
    activeSessions: number;
    totalCallbacks: number;
    statusStats: {
      total: number;
      idle: number;
      busy: number;
      retry: number;
      error: number;
    };
  } {
    let totalCallbacks = 0;
    for (const state of this.sessionStates.values()) {
      totalCallbacks += state.callbacks.length;
    }

    return {
      activeSessions: this.processors.size,
      totalCallbacks,
      statusStats: this.sessionStatusManager.getStats(),
    };
  }

  /**
   * 创建会话处理器
   *
   * @param sessionKey - 会话键
   * @param channel - 渠道
   * @param chatId - 会话 ID
   * @returns 处理器实例
   */
  private createProcessor(
    sessionKey: string,
    channel: string,
    chatId: string,
  ): SessionProcessor {
    const { SessionProcessor } = require('./session-processor');
    return new SessionProcessor({
      sessionKey,
      channel,
      chatId,
      sessionOrchestrator: this.sessionOrchestrator,
      streamBridge: this.streamBridge,
      toolRuntime: this.toolRuntime,
      config: this.config,
    });
  }
}
