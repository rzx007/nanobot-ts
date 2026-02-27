/**
 * CLI 渠道确认处理器
 *
 * 使用 inquirer 实现交互式确认对话框
 */

import inquirer from 'inquirer';
import type { ApprovalHandler, ConfirmationRequest } from './index-internal';
import { logger } from '../../utils/logger';

/**
 * CLI 渠道确认处理器
 */
export class CLIApprovalHandler implements ApprovalHandler {
  /**
   * 请求用户确认
   *
   * @param req - 确认请求
   * @returns 确认结果
   */
  async requestConfirmation(req: ConfirmationRequest): Promise<boolean> {
    const { toolName, params } = req;

    // 格式化参数显示
    const paramsDisplay = this.formatParams(params);

    // 构建确认消息
    const message = this.buildConfirmationMessage(toolName, paramsDisplay);

    try {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message,
          default: false,
        },
      ]);

      const approved = answer.approved as boolean;

      if (approved) {
        logger.info({ toolName, params }, 'User approved tool execution');
      } else {
        logger.info({ toolName, params }, 'User declined tool execution');
      }

      return approved;
    } catch (error) {
      logger.error({ error, toolName, params }, 'CLI confirmation failed');
      return false;
    }
  }

  /**
   * 格式化参数显示
   *
   * @param params - 工具参数
   * @returns 格式化的参数字符串
   */
  private formatParams(params: Record<string, unknown>): string {
    const entries = Object.entries(params);
    if (entries.length === 0) {
      return '(无参数)';
    }

    return entries
      .map(([key, value]) => {
        const valueStr = JSON.stringify(value);
        const truncated = valueStr.length > 50 ? `${valueStr.slice(0, 50)}...` : valueStr;
        return `${key}=${truncated}`;
      })
      .join(', ');
  }

  /**
   * 构建确认消息
   *
   * @param toolName - 工具名称
   * @param paramsDisplay - 格式化的参数
   * @returns 确认消息
   */
  private buildConfirmationMessage(toolName: string, paramsDisplay: string): string {
    return `⚠️  工具执行需要确认\n   工具: ${toolName}\n   参数: ${paramsDisplay}\n   是否继续?`;
  }
}
