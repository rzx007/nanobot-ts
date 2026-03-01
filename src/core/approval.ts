/**
 * 确认管理器
 *
 * 统一管理所有渠道的工具确认逻辑
 */

import type { ApprovalHandler, ConfirmationRequest } from './approval-handlers/types';
import { ApprovalMemory } from './approval-handlers/memory';
import { ApprovalConfigSchema, type ApprovalConfig } from '../config/approval-schema';
import type { Config } from '../config/schema';
import { RiskLevel, DEFAULT_RISK_LEVELS } from '../tools/safety';
import { logger } from '../utils/logger';
import type { IMessageBus } from '../bus/types';
import { CLIApprovalHandler } from './approval-handlers/cli';
import { MessageApprovalHandler } from './approval-handlers/message';
/**
 * 确认管理器
 *
 * 负责协调不同渠道的确认处理器，管理确认流程
 */
export class ApprovalManager {
  name = 'approval';
  
  /** 确认处理器映射表 */
  private handlers: Map<string, ApprovalHandler>;

  /** 会话记忆管理器 */
  private memory: ApprovalMemory;

  /** 确认配置（从 Config 解析） */
  private config: ApprovalConfig;

  /** 主配置（用于 initializeDefaultHandlers 按渠道注册） */
  private appConfig: Config;

  /** 默认风险级别 */
  private defaultRiskLevels: Record<string, RiskLevel>;

  /**
   * 构造函数
   *
   * @param config - 主配置（确认配置从 config.tools?.approval 解析）
   * @param memory - 会话记忆管理器（可选，默认根据确认配置新建）
   */
  constructor(config: Config, memory?: ApprovalMemory) {
    this.appConfig = config;
    this.config = ApprovalConfigSchema.parse(config.tools?.approval ?? {});
    this.memory = memory ?? new ApprovalMemory(this.config);
    this.handlers = new Map();
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
   * 初始化默认处理器
   *
   * 按渠道名注册：cli 使用 CLI 处理器，feishu/whatsapp/email 使用消息处理器（根据构造函数传入的 config 中已启用的渠道）。
   *
   * @param bus - 消息总线（可选，用于消息渠道）
   * @param tui - 是否是 TUI 模式
   */
  initializeDefaultHandlers(bus?: IMessageBus, tui?: boolean): void {
    // 注册 CLI 处理器
    if (!tui) {
      // 非 TUI 模式下，注册 CLI 处理器
      this.registerHandler('cli', new CLIApprovalHandler());
    } 

    // 根据 appConfig 为已启用的消息渠道逐个注册 MessageApprovalHandler（与 ChannelManager 判定一致）
    if (bus) {
      const { whatsapp, feishu, email } = this.appConfig.channels;
      const messageHandler = new MessageApprovalHandler(bus);
      if(tui) {
        // TUI 模式下，使用 MessageApprovalHandler 处理 CLI 消息
        this.registerHandler('cli', messageHandler);
      }
      if (whatsapp.enabled) {
        this.registerHandler('whatsapp', messageHandler);
      }
      if (feishu.enabled && feishu.appId && feishu.appSecret) {
        this.registerHandler('feishu', messageHandler);
      }
      if (
        email.enabled &&
        email.consentGranted &&
        email.imapHost &&
        email.imapUsername &&
        email.smtpHost &&
        email.smtpUsername &&
        email.fromAddress
      ) {
        this.registerHandler('email', messageHandler);
      }
    }
  }

  /**
   * 注册确认处理器
   *
   * @param channel - 渠道名称
   * @param handler - 确认处理器
   */
  registerHandler(channel: string, handler: ApprovalHandler): void {
    this.handlers.set(channel, handler);
    logger.info(`Approval handler registered for channel: ${channel}`);
  }

  /**
   * 注销确认处理器
   *
   * @param channel - 渠道名称
   */
  unregisterHandler(channel: string): void {
    this.handlers.delete(channel);
    logger.info(`Approval handler unregistered for channel: ${channel}`);
  }

  /**
   * 获取确认处理器
   *
   * @param channel - 渠道名称
   * @returns 确认处理器或 undefined
   */
  getHandler(channel: string): ApprovalHandler | undefined {
    return this.handlers.get(channel);
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
   * 请求用户确认 (给渠道(whatsapp、feishu、email 等)发送确认消息, 等待用户回复)
   *
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否批准
   */
  async requestApproval(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): Promise<boolean> {
    const handler = this.getHandler(channel);

    if (!handler) {
      logger.warn(`No approval handler for channel: ${channel}, denying by default`);
      return false;
    }

    const req: ConfirmationRequest = {
      toolName,
      params,
      channel,
      chatId,
      timeout: this.config.timeout,
    };

    try {
      logger.info({ toolName, channel, chatId }, 'Requesting user approval');

      // 渠道的确认处理器 来处理确认请求
      const approved = await handler!.requestApproval(req);

      if (approved) {
        // 记录到会话记忆
        this.memory.recordApproval(toolName, params, channel, chatId);
        logger.info({ toolName, channel, chatId }, 'User approved tool execution');
      } else {
        logger.info({ toolName, channel, chatId }, 'User declined tool execution');
      }

      return approved;
    } catch (error) {
      logger.error({ error, toolName, channel, chatId }, 'Approval request failed');
      return false;
    }
  }

  /**
   * 取消待处理的确认
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   */
  cancelPending(channel: string, chatId: string): void {
    const handler = this.getHandler(channel);
    if (handler?.cancelPending) {
      handler.cancelPending(chatId);
    }
  }

  /**
   * 处理用户消息（用于消息渠道的确认回复）
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @param content - 消息内容
   * @returns 是否是确认回复（true表示已处理，false表示普通消息）
   */
  handleUserMessage(channel: string, chatId: string, content: string): boolean {
    const handler = this.getHandler(channel);
    if (handler && 'handleUserMessage' in handler && typeof handler.handleUserMessage === 'function') {
      return handler.handleUserMessage(channel, chatId, content);
    }
    return false;
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
    registeredHandlers: string[];
    strictMode: boolean;
    memoryWindow: number;
  } {
    return {
      enabled: this.config.enabled,
      memorySize: this.memory.size,
      registeredHandlers: Array.from(this.handlers.keys()),
      strictMode: this.config.strictMode,
      memoryWindow: this.config.memoryWindow,
    };
  }
}
