/**
 * 工具注册表
 *
 * 管理所有工具的注册、注销和执行
 */

import { logger } from '@nanobot/logger';
import type { Tool } from './base';
import type { ToolSet } from '@nanobot/shared';

/**
 * 审批检查接口
 *
 * 解耦 ToolRegistry 与具体的 ApprovalManager 实现
 */
export interface ApprovalCheck {
  /**
   * 检查是否需要确认
   *
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param toolRiskLevel - 工具风险级别
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否需要确认
   */
  needsApproval(
    toolName: string,
    params: Record<string, unknown>,
    toolRiskLevel: unknown,
    channel: string,
    chatId: string,
  ): Promise<boolean>;

  /**
   * 请求用户确认
   *
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 是否批准
   */
  request(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): Promise<boolean>;
}

/**
 * 工具注册表
 *
 * 负责工具的生命周期管理和执行
 */
export class ToolRegistry {
  /** 工具映射表 */
  private readonly tools = new Map<string, Tool>();

  /** 审批检查器 */
  private approvalCheck?: ApprovalCheck;

  /**
   * 设置审批检查器
   *
   * @param check - 审批检查器
   */
  setApprovalCheck(check: ApprovalCheck): void {
    this.approvalCheck = check;
    logger.info('ApprovalCheck set in ToolRegistry');
  }

  /**
   * 获取审批检查器
   *
   * @returns 审批检查器或 undefined
   */
  getApprovalCheck(): ApprovalCheck | undefined {
    return this.approvalCheck;
  }

  /**
   * 注册工具
   *
   * @param tool - 工具实例
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" already exists, will be overwritten`);
    }
    this.tools.set(tool.name, tool);
    logger.info(`Tool registered: ${tool.name}`);
  }

  /**
   * 注销工具
   *
   * @param name - 工具名称
   * @returns 是否成功注销
   */
  unregister(name: string): boolean {
    if (this.tools.delete(name)) {
      logger.info(`Tool unregistered: ${name}`);
      return true;
    } else {
      logger.warn(`Tool not found: ${name}`);
      return false;
    }
  }

  /**
   * 获取工具
   *
   * @param name - 工具名称
   * @returns 工具实例或 undefined
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 检查工具是否存在
   *
   * @param name - 工具名称
   * @returns 工具是否存在
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * 获取所有工具名称
   *
   * @returns 工具名称数组
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * 获取所有工具定义 (AI SDK ToolSet 格式，可直接传入 generateText)
   */
  getDefinitions(): ToolSet {
    const result: ToolSet = {};
    for (const [name, t] of this.tools) {
      result[name] = t.toSchema();
    }
    return result;
  }

  /**
   * 执行工具
   *
   * @param name - 工具名称
   * @param params - 工具参数
   * @param context - 执行上下文（可选）
   * @returns 执行结果
   */
  async execute(
    name: string,
    params: Record<string, unknown>,
    context?: {
      channel?: string;
      chatId?: string;
    },
  ): Promise<string> {
    // 错误提示后缀
    const ERROR_HINT = '\n\n[Please analyze the error above and try a different approach.]';

    // 查找工具
    const tool = this.tools.get(name);
    if (!tool) {
      const errorMsg = `Error: Tool "${name}" not found. Available tools: ${this.getToolNames().join(', ')}`;
      logger.error(errorMsg);
      return errorMsg + ERROR_HINT;
    }

    // 验证参数
    const validationErrors = tool.validateParams(params);
    if (validationErrors.length > 0) {
      const errorMsg = `Error: Invalid params for tool "${name}": ${validationErrors.join('; ')}`;
      logger.error(errorMsg);
      return errorMsg + ERROR_HINT;
    }

    // 检查是否需要确认（人工交互确认）
    if (this.approvalCheck && context?.channel && context?.chatId) {
      const needsApproval = await this.approvalCheck.needsApproval(
        name,
        params,
        tool.riskLevel,
        context.channel,
        context.chatId,
      );
      if (needsApproval) {
        const approved = await this.approvalCheck.request(
          name,
          params,
          context.channel,
          context.chatId,
        );

        if (!approved) {
          const errorMsg = `Tool "${name}" execution declined by user. Do not retry or try other tools for this action; acknowledge and wait for user instructions.`;
          logger.warn(errorMsg);
          return errorMsg + ERROR_HINT;
        }
      }
    }

    // 执行工具
    try {
      logger.info(`✈️✈️✈️  Executing tool: ${name}`);
      const result = await tool.execute(params);

      // 检查结果是否为错误
      if (typeof result === 'string' && result.startsWith('Error')) {
        return result + ERROR_HINT;
      }

      logger.info(`🚀🚀🚀 Tool "${name}" executed successfully`);
      return result;
    } catch (error) {
      const errorMsg = `Error executing tool "${name}": ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return errorMsg + ERROR_HINT;
    }
  }

  /**
   * 获取工具数量
   *
   * @returns 工具数量
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * 清空所有工具
   */
  clear(): void {
    const count = this.tools.size;
    this.tools.clear();
    logger.info(`Cleared ${count} tools`);
  }
}
