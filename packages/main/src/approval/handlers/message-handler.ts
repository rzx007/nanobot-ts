/**
 * Message Approval Handler
 *
 * 用于 WhatsApp、Feishu、Email 等消息渠道的审批机制
 */

import type { ApprovalEvent, ApprovalManager } from '@nanobot/shared';
import type { IMessageBus } from '@nanobot/shared';
import { logger } from '@nanobot/logger';

export class MessageApprovalHandler {
  constructor(
    private bus: IMessageBus,
    private approvalManager: ApprovalManager
  ) { }

  /**
   * 处理审批事件
   *
   * @param event - 审批事件
   */
  handleApproval(event: ApprovalEvent): void {
    if (event.type !== 'approval.asked') return;

    const paramsDisplay = this.formatParams(event.params);
    const message = this.buildConfirmationMessage(
      event.toolName,
      paramsDisplay,
      event.timeout
    );

    // 发送确认消息到三方渠道
    this.bus.publishOutbound({
      channel: event.channel,
      chatId: event.chatId,
      content: message,
      metadata: { approvalRequestID: event.requestID },
    });

    logger.info(
      { requestID: event.requestID, toolName: event.toolName },
      'Confirmation message sent via event'
    );
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
   * @param timeout - 超时时间（秒）
   * @returns 确认消息
   */
  private buildConfirmationMessage(
    toolName: string,
    paramsDisplay: string,
    timeout: number,
  ): string {
    return (
      `⚠️ 工具执行需要确认\n` +
      `工具: ${toolName}\n` +
      `参数: ${paramsDisplay}\n` +
      `超时: ${timeout}秒\n\n` +
      `回复 "yes" 确认，"no" 取消`
    );
  }
}
