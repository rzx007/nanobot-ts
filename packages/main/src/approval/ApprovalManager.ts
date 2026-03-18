/**
 * 确认管理器
 *
 * 统一管理所有渠道的工具确认逻辑，使用事件驱动架构
 */

import type { ApprovalEvent } from '@nanobot/shared';
import { ApprovalMemory } from './memory';
import { ApprovalConfigSchema, type ApprovalConfig } from '@nanobot/shared';
import type { Config } from '@nanobot/shared';
import { RiskLevel, DEFAULT_RISK_LEVELS } from '@nanobot/shared';
import { logger } from '@nanobot/logger';
import type { MessageBus } from '../bus/queue';

interface PendingApproval {
  toolName: string;
  params: Record<string, unknown>;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  channel: string;
  chatId: string;
}

/**
 * 确认管理器
 *
 * 负责协调不同渠道的确认处理器，管理确认流程
 * 使用事件驱动架构，所有确认请求都通过 bus.emit('approval') 发出
 */
export class ApprovalManager {
  name = 'approval';

  /** 待处理的确认请求 */
  private pending = new Map<string, PendingApproval>();

  /** 会话记忆管理器 */
  private memory: ApprovalMemory;

  /** 确认配置（从 Config 解析） */
  private config: ApprovalConfig;

  /** 消息总线 */
  private bus: MessageBus;

  /** 默认风险级别 */
  private defaultRiskLevels: Record<string, RiskLevel>;

  /**
   * 构造函数
   *
   * @param config - 主配置（确认配置从 config.tools?.approval 解析）
   * @param bus - 消息总线
   * @param memory - 会话记忆管理器（可选，默认根据确认配置新建）
   */
  constructor(
    config: Config,
    bus: MessageBus,
    memory?: ApprovalMemory
  ) {
    this.config = ApprovalConfigSchema.parse(config.tools?.approval ?? {});
    this.bus = bus;
    this.memory = memory ?? new ApprovalMemory(this.config);
    this.defaultRiskLevels = DEFAULT_RISK_LEVELS;

    logger.info(
      {
        enabled: this.config.enabled,
        memoryWindow: this.config.memoryWindow,
        timeout: this.config.timeout,
        strictMode: this.config.strictMode,
      },
      'ApprovalManager initialized',
    );
  }

  /**
   * 检查是否需要确认
   *
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param toolRiskLevel - 工具风险级别（可选）
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否需要确认
   */
  async needsApproval(
    toolName: string,
    params: Record<string, unknown>,
    toolRiskLevel: RiskLevel | undefined,
    channel: string,
    chatId: string,
  ): Promise<boolean> {
    // 检查全局开关
    if (!this.config.enabled) {
      return false;
    }

    // 检查工具级别的配置覆盖
    if (toolName in this.config.toolOverrides) {
      const override = this.config.toolOverrides[toolName];
      if (override) {
        return override.requiresApproval;
      }
    }

    // 获取风险级别
    const riskLevel = toolRiskLevel ?? this.defaultRiskLevels[toolName] ?? RiskLevel.LOW;

    // 严格模式：所有非LOW风险都需要确认
    if (this.config.strictMode && riskLevel !== RiskLevel.LOW) {
      if (this.config.enableLogging) {
        logger.debug({ toolName, riskLevel, mode: 'strict' }, 'Approval required (strict mode)');
      }
      return true;
    }

    // 高风险：总是需要确认
    if (riskLevel === RiskLevel.HIGH) {
      if (this.config.enableLogging) {
        logger.debug({ toolName, riskLevel }, 'Approval required (HIGH risk)');
      }
      return true;
    }

    // 中风险：检查会话记忆
    if (riskLevel === RiskLevel.MEDIUM) {
      const approved = this.memory.hasApproved(toolName, params, channel, chatId);
      if (this.config.enableLogging) {
        logger.debug({ toolName, riskLevel, approved, channel, chatId }, 'Memory check result');
      }
      return !approved;
    }

    // 低风险：无需确认
    if (this.config.enableLogging) {
      logger.debug({ toolName, riskLevel }, 'Approval not required (LOW risk)');
    }
    return false;
  }

  /**
   * 工具执行前，请求用户确认
   * 发出事件 'approval'，由各渠道的监听器处理
   *
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否批准
   */
  async request(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): Promise<boolean> {
    // 检查是否需要确认
    const needsCheck = await this.needsApproval(toolName, params, undefined, channel, chatId);
    if (!needsCheck) {
      return true;
    }

    // 生成唯一请求ID
    const requestID = this.generateRequestID();

    logger.info({ requestID, toolName, channel, chatId }, 'Approval requested');

    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup(requestID);
        logger.warn({ requestID }, 'Approval timed out');
        resolve(false); // 超时默认拒绝
      }, this.config.timeout * 1000);

      this.pending.set(requestID, {
        toolName,
        params,
        resolve,
        reject,
        timer,
        channel,
        chatId,
      });

      // 发出事件（统一入口）
      const event: ApprovalEvent = {
        type: 'approval.asked',
        requestID,
        channel,
        chatId,
        toolName,
        params,
        timeout: this.config.timeout,
        timestamp: new Date(),
      };

      this.bus.emit('approval', event);
    });
  }

  /**
   * 解析审批请求
   * 由各渠道监听 'approval' 事件后调用此方法
   *
   * @param requestID - 请求ID
   * @param approved - 是否批准
   */
  async respond(requestID: string, approved: boolean): Promise<void> {
    const pending = this.pending.get(requestID);
    if (!pending) {
      throw new Error(`Approval request not found: ${requestID}`);
    }

    logger.info({ requestID, approved }, 'Approval resolved');

    // 如果批准，记录到记忆
    if (approved) {
      this.memory.recordApproval(pending.toolName, pending.params, pending.channel, pending.chatId);
    }

    this.cleanup(requestID);

    // 发出回复事件
    const event: ApprovalEvent = {
      type: 'approval.replied',
      requestID,
      channel: pending.channel,
      chatId: pending.chatId,
      toolName: pending.toolName,
      params: pending.params,
      timeout: this.config.timeout,
      timestamp: new Date(),
    };

    this.bus.emit('approval', event);

    pending.resolve(approved);
  }

  /**
   * 取消审批请求
   *
   * @param requestID - 请求ID
   */
  cancel(requestID: string): void {
    const pending = this.pending.get(requestID);
    if (pending) {
      this.cleanup(requestID);
      pending.reject(new Error('Approval cancelled'));
      logger.info({ requestID }, 'Approval cancelled');
    }
  }
  /**
   * 关闭管理器，清理所有待处理请求
   */
  close(): void {
    for (const [requestID] of this.pending) {
      this.cancel(requestID);
    }
  }

  /**
   * 获取待处理数量
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * 获取会话记忆管理器
   *
   * @returns 会话记忆管理器
   */
  getMemory(): ApprovalMemory {
    return this.memory;
  }

  /**
   * 清除指定聊天的所有记忆
   *
   * @param chatId - 聊天ID
   */
  clearChatMemory(chatId: string): void {
    this.memory.clearChat(chatId);
  }

  /**
   * 清除指定渠道的所有记忆
   *
   * @param channel - 渠道
   */
  clearChannelMemory(channel: string): void {
    this.memory.clearChannel(channel);
  }

  /**
   * 清除所有过期记忆
   *
   * @returns 清除的记录数
   */
  clearExpiredMemory(): number {
    return this.memory.clearExpired();
  }

  /**
   * 清除所有记忆
   */
  clearAllMemory(): void {
    this.memory.clearAll();
  }

  /**
   * 获取配置
   *
   * @returns 配置对象
   */
  getConfig(): ApprovalConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   *
   * @param newConfig - 新配置
   */
  updateConfig(newConfig: Partial<ApprovalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info({ config: this.config }, 'ApprovalManager config updated');
  }

  /**
   * 获取统计信息
   *
   * @returns 统计信息
   */
  getStats(): {
    enabled: boolean;
    memorySize: number;
    pendingCount: number;
    strictMode: boolean;
    memoryWindow: number;
  } {
    return {
      enabled: this.config.enabled,
      memorySize: this.memory.size,
      pendingCount: this.pending.size,
      strictMode: this.config.strictMode,
      memoryWindow: this.config.memoryWindow,
    };
  }

  /**
   * 生成请求ID
   *
   * @returns 请求ID
   */
  private generateRequestID(): string {
    return `apr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 清理待处理记录
   *
   * @param requestID - 请求ID
   */
  private cleanup(requestID: string): void {
    const pending = this.pending.get(requestID);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(requestID);
    }
  }
}
