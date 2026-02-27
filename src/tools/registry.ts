/**
 * 工具注册表
 *
 * 管理所有工具的注册、注销和执行
 */

import { logger } from '../utils/logger';
import type { Tool } from './base';
import type { ToolSet } from '../bus/events';
import type { ApprovalManager } from '../core/approval';

/**
 * 工具注册表
 *
 * 负责工具的生命周期管理和执行
 */
export class ToolRegistry {
  /** 工具映射表 */
  private readonly tools = new Map<string, Tool>();

  /** 确认管理器 */
  private approvalManager?: ApprovalManager;

  /**
   * 设置确认管理器
   *
   * @param manager - 确认管理器
   */
  setApprovalManager(manager: ApprovalManager): void {
    this.approvalManager = manager;
    logger.info('ApprovalManager set in ToolRegistry');
  }

  /**
   * 获取确认管理器
   *
   * @returns 确认管理器或 undefined
   */
  getApprovalManager(): ApprovalManager | undefined {
    return this.approvalManager;
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
    if (this.approvalManager && context?.channel && context?.chatId) {
      const needsApproval = await this.approvalManager.needsApproval(
        name,
        params,
        tool.riskLevel,
        context.channel,
        context.chatId,
      );
      if (needsApproval) {
        const approved = await this.approvalManager.requestApproval(
          name,
          params,
          context.channel,
          context.chatId,
        );

        if (!approved) {
          const errorMsg = `Tool "${name}" execution declined by user. Please try a different approach.`;
          logger.warn(errorMsg);
          return errorMsg + ERROR_HINT;
        }
      }
    }

    // 执行工具
    try {
      logger.info(`Executing tool: ${name}`);
      const result = await tool.execute(params);

      // 检查结果是否为错误
      if (typeof result === 'string' && result.startsWith('Error')) {
        return result + ERROR_HINT;
      }

      logger.info(`Tool "${name}" executed successfully`);
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
