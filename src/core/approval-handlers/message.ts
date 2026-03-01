/**
 * 消息渠道确认处理器
 *
 * 用于 WhatsApp、Feishu、Email 等消息渠道的确认机制
 */

import type { IMessageBus } from '@/bus/types';
import type { ApprovalHandler, ConfirmationRequest } from './types';
import { logger } from '@/utils/logger';

/**
 * Promise 解析器接口
 */
interface PromiseResolver {
  resolve: (value: boolean) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

/**
 * 待处理确认记录
 */
interface PendingApproval {
  req: ConfirmationRequest;
  resolver: PromiseResolver;
  approvalId: string;
}

/**
 * 消息渠道确认处理器
 */
export class MessageApprovalHandler implements ApprovalHandler {
  /** 消息发布器 */
  private publisher: IMessageBus;

  /** 待处理的确认请求 */
  private pendingApprovals: Map<string, PendingApproval>;

  /** 按chatId索引的确认请求 */
  private approvalsByChatId: Map<string, string>;

  /**
   * 构造函数
   *
   * @param publisher - 消息发布器
   */
  constructor(publisher: IMessageBus) {
    this.publisher = publisher;
    this.pendingApprovals = new Map();
    this.approvalsByChatId = new Map();
  }

  /**
   * 请求用户确认 发送确认消息给whatsapp、feishu 等渠道
   *
   * @param req - 确认请求
   * @returns 确认结果
   */
  async requestApproval(req: ConfirmationRequest): Promise<boolean> {
    const { toolName, params, channel, chatId, timeout } = req;

    // 生成唯一ID
    const approvalId = this.generateApprovalId(toolName, params, channel, chatId);

    // 格式化参数显示
    const paramsDisplay = this.formatParams(params);

    // 构建确认消息
    const message = this.buildConfirmationMessage(toolName, paramsDisplay, timeout);

    // 发送确认消息给whatsapp、feishu、email 等渠道
    try {
      await this.publisher.publishOutbound({ channel, chatId, content: message });

      logger.info({ approvalId, toolName, chatId }, 'Confirmation message sent');
    } catch (error) {
      logger.error({ error, approvalId }, 'Failed to send confirmation message');
      return false;
    }

    // 创建 Promise 并等待用户回复
    return new Promise<boolean>(resolve => {
      const timeoutId = setTimeout(() => {
        this.cleanup(approvalId);
        logger.warn({ approvalId }, 'Confirmation timed out');
        resolve(false); // 超时默认拒绝
      }, timeout * 1000);

      const resolver: PromiseResolver = {
        resolve,
        timeoutId,
        createdAt: Date.now(),
      };

      const pending: PendingApproval = {
        req,
        resolver,
        approvalId,
      };

      this.pendingApprovals.set(approvalId, pending);
      this.approvalsByChatId.set(chatId, approvalId);

      logger.info({ approvalId, chatId }, 'Pending approval registered');
    });
  }

  /**
   * 处理用户回复 处理whatsapp、feishu 等渠道的确认回复
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @param content - 回复内容
   * @returns 是否成功处理（true表示是确认回复，false表示普通消息）
   */
  handleUserMessage(channel: string, chatId: string, content: string): boolean {
    const trimmed = content.trim().toLowerCase();

    // 检查是否是确认回复
    const approved = this.isPositiveResponse(trimmed);
    const rejected = this.isNegativeResponse(trimmed);

    if (!approved && !rejected) {
      return false; // 不是确认回复
    }

    // 查找待处理的确认
    const approvalId = this.approvalsByChatId.get(chatId);
    if (!approvalId) {
      logger.info({ chatId }, 'No pending approval for this chat');
      return false;
    }

    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      logger.warn({ approvalId }, 'Pending approval not found');
      this.approvalsByChatId.delete(chatId);
      return false;
    }

    // 验证渠道匹配
    if (pending.req.channel !== channel) {
      logger.warn({ approvalId, channel }, 'Channel mismatch');
      return false;
    }

    // 清理
    clearTimeout(pending.resolver.timeoutId);
    this.cleanup(approvalId);

    // 解析 Promise
    if (approved) {
      logger.info({ approvalId, chatId }, 'User approved via message');
      pending.resolver.resolve(true); // ← 关键：唤醒等待中的 Promise
    } else {
      logger.info({ approvalId, chatId }, 'User declined via message');
      pending.resolver.resolve(false);
    }

    return true;  // ← 返回 true 表示已处理确认回复
  }

  /**
   * 取消待处理的确认 取消待处理的确认请求
   *
   * @param chatId - 聊天ID
   */
  cancelPending(chatId: string): void {
    const approvalId = this.approvalsByChatId.get(chatId);
    if (approvalId) {
      const pending = this.pendingApprovals.get(approvalId);
      if (pending) {
        clearTimeout(pending.resolver.timeoutId);
        this.cleanup(approvalId);
        logger.info({ approvalId, chatId }, 'Pending approval cancelled');
      }
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

  /**
   * 生成确认ID
   *
   * @param toolName - 工具名称
   * @param params - 参数
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 确认ID
   */
  private generateApprovalId(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string,
  ): string {
    const paramsHash = this.simpleHash(JSON.stringify(params));
    return `${channel}:${chatId}:${toolName}:${paramsHash}:${Date.now()}`;
  }

  /**
   * 简单哈希函数
   *
   * @param str - 输入字符串
   * @returns 哈希值
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 检查是否是肯定回复
   *
   * @param content - 回复内容
   * @returns 是否肯定
   */
  private isPositiveResponse(content: string): boolean {
    return content === 'yes' || content === 'y' || content === '是' || content === '确认';
  }

  /**
   * 检查是否是否定回复
   *
   * @param content - 回复内容
   * @returns 是否否定
   */
  private isNegativeResponse(content: string): boolean {
    return content === 'no' || content === 'n' || content === '否' || content === '取消';
  }

  /**
   * 清理待处理记录
   *
   * @param approvalId - 确认ID
   */
  private cleanup(approvalId: string): void {
    const pending = this.pendingApprovals.get(approvalId);
    if (pending) {
      this.approvalsByChatId.delete(pending.req.chatId);
      this.pendingApprovals.delete(approvalId);
    }
  }
}
