/**
 * CLI Approval Handler
 *
 * 处理 CLI 渠道的审批交互
 */

import inquirer from 'inquirer';
import type { ApprovalEvent, ApprovalManager } from '@nanobot/shared';

export class CLIApprovalHandler {
  constructor(private approvalManager: ApprovalManager) { }

  /**
   * 处理审批事件
   *
   * @param event - 审批事件
   */
  async handleApproval(event: ApprovalEvent): Promise<void> {
    if (event.type !== 'approval.asked') return;

    const paramsDisplay = this.formatParams(event.params);
    console.log(`\n⚠️ 工具执行需要确认`);
    console.log(`工具: ${event.toolName}`);
    console.log(`参数: ${paramsDisplay}`);
    console.log(`超时: ${event.timeout}秒\n`);

    try {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message: '是否允许执行此操作？',
          default: false,
        },
      ]);

      await this.approvalManager.respond(event.requestID, answers.approved);
    } catch (error) {
      console.error('Failed to process approval:', error);
      await this.approvalManager.respond(event.requestID, false);
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
}
