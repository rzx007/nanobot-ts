/**
 * 工具基类
 *
 * 所有工具的抽象基类，toSchema() 返回 AI SDK 兼容的 Tool
 */

import { jsonSchema, tool, type Tool as AITool } from 'ai';

/**
 * 工具基类
 * 
 * 所有自定义工具必须继承此类并实现必需的属性和方法
 */
export abstract class Tool {
  /**
   * 工具名称 (唯一标识符)
   */
  abstract name: string;

  /**
   * 工具描述 (向 LLM 说明工具用途)
   */
  abstract description: string;

  /**
   * 工具参数定义 (JSON Schema 格式)
   */
  abstract parameters: Record<string, unknown>;

  /**
   * 验证参数
   * 
   * @param params - 工具参数
   * @returns 错误消息数组，如果验证通过则返回空数组
   */
  validateParams(params: Record<string, unknown>): string[] {
    const errors: string[] = [];
    const required = Array.isArray(this.parameters.required) ? this.parameters.required : [];

    // 检查必需参数
    for (const field of required) {
      if (!(field in params)) {
        errors.push(`缺少必需参数: ${field}`);
      }
    }

    // 检查额外参数
    const props = this.parameters.properties;
    const allowedFields = props && typeof props === 'object' ? Object.keys(props) : [];
    for (const field of Object.keys(params)) {
      if (!allowedFields.includes(field)) {
        errors.push(`未知参数: ${field}`);
      }
    }

    return errors;
  }

  /**
   * 执行工具
   * 
   * @param params - 工具参数
   * @returns 执行结果 (字符串格式)
   */
  abstract execute(params: Record<string, unknown>): Promise<string>;

  /**
   * 转换为 AI SDK Tool 格式 (可直接用于 generateText 的 tools)
   */
  toSchema(): AITool {
    return tool({
      description: this.description,
      inputSchema: jsonSchema(this.parameters),
    });
  }
}
