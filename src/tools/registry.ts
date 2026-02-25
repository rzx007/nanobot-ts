/**
 * 工具注册表
 * 
 * 管理所有工具的注册、注销和执行
 */

import { logger } from '../utils/logger';
import type { Tool } from './base';
import type { ToolSet } from '../bus/events';

/**
 * 工具注册表
 * 
 * 负责工具的生命周期管理和执行
 */
export class ToolRegistry {
  /** 工具映射表 */
  private readonly tools = new Map<string, Tool>();

  /**
   * 注册工具
   * 
   * @param tool - 工具实例
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`工具 "${tool.name}" 已存在，将被覆盖`);
    }
    this.tools.set(tool.name, tool);
    logger.info(`工具注册成功: ${tool.name}`);
  }

  /**
   * 注销工具
   * 
   * @param name - 工具名称
   * @returns 是否成功注销
   */
  unregister(name: string): boolean {
    if (this.tools.delete(name)) {
      logger.info(`工具注销成功: ${name}`);
      return true;
    } else {
      logger.warn(`工具不存在: ${name}`);
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
   * @returns 执行结果
   */
  async execute(name: string, params: Record<string, unknown>): Promise<string> {
    // 错误提示后缀
    const ERROR_HINT = '\n\n[请分析上面的错误并尝试不同的方法。]';

    // 查找工具
    const tool = this.tools.get(name);
    if (!tool) {
      const errorMsg = `错误: 工具 "${name}" 不存在。可用工具: ${this.getToolNames().join(', ')}`;
      logger.error(errorMsg);
      return errorMsg + ERROR_HINT;
    }

    // 验证参数
    const validationErrors = tool.validateParams(params);
    if (validationErrors.length > 0) {
      const errorMsg = `错误: 工具 "${name}" 的参数无效: ${validationErrors.join('; ')}`;
      logger.error(errorMsg);
      return errorMsg + ERROR_HINT;
    }

    // 执行工具
    try {
      logger.info(`执行工具: ${name}`);
      const result = await tool.execute(params);

      // 检查结果是否为错误
      if (typeof result === 'string' && result.startsWith('Error')) {
        return result + ERROR_HINT;
      }

      logger.info(`工具 "${name}" 执行成功`);
      return result;
    } catch (error) {
      const errorMsg = `执行工具 "${name}" 时出错: ${error instanceof Error ? error.message : String(error)}`;
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
    logger.info(`已清空 ${count} 个工具`);
  }
}
