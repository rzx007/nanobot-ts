/**
 * Question Manager
 *
 * 管理用户问题的提问和回答，类似 ApprovalManager 的设计模式
 */

import { createLogger } from '@nanobot/logger';
import type { MessageBus } from '../bus/queue';
import type { Question, QuestionEvent, QuestionManager as IQuestionManager } from '@nanobot/shared';

function generateRequestID(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

interface PendingQuestion {
  questions: Question[];
  resolve: (answers: string[][]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  channel: string;
  chatId: string;
}

export class QuestionManager implements IQuestionManager {
  private pending = new Map<string, PendingQuestion>();
  private logger = createLogger('question');

  constructor(
    private bus: MessageBus,
    private config: { timeout: number }
  ) {
    this.logger.info('QuestionManager initialized');
  }

  /**
   * 发起问题提问
   *
   * @param questions - 问题列表
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @returns 用户回答（每个问题的选项标签数组）
   */
  async ask(
    questions: Question[],
    channel: string,
    chatId: string
  ): Promise<string[][]> {
    const requestID = generateRequestID();

    this.logger.info({ requestID, channel, chatId, count: questions.length }, 'Question asked');

    return new Promise<string[][]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup(requestID);
        reject(new Error(`Question timeout after ${this.config.timeout}s`));
      }, this.config.timeout * 1000);

      this.pending.set(requestID, {
        questions,
        resolve,
        reject,
        timer,
        channel,
        chatId,
      });

      const event: QuestionEvent = {
        type: 'question.asked',
        requestID,
        channel,
        chatId,
        questions,
        timestamp: new Date(),
      };

      this.bus.emit('question', event);
    });
  }

  /**
   * 处理用户回答
   *
   * @param requestID - 请求ID
   * @param answers - 用户回答（每个问题选中的选项标签数组）
   */
  async reply(requestID: string, answers: string[][]): Promise<void> {
    const pending = this.pending.get(requestID);
    if (!pending) {
      throw new Error(`Question request not found: ${requestID}`);
    }

    this.logger.info({ requestID, answers }, 'Question replied');

    this.cleanup(requestID);

    const event: QuestionEvent = {
      type: 'question.replied',
      requestID,
      channel: pending.channel,
      chatId: pending.chatId,
      questions: pending.questions,
      timestamp: new Date(),
    };

    this.bus.emit('question', event);

    pending.resolve(answers);
  }

  /**
   * 取消问题
   *
   * @param requestID - 请求ID
   */
  cancel(requestID: string): void {
    const pending = this.pending.get(requestID);
    if (pending) {
      this.cleanup(requestID);
      pending.reject(new Error('Question cancelled'));
      this.logger.info({ requestID }, 'Question cancelled');
    }
  }

  /**
   * 清理待处理请求
   */
  private cleanup(requestID: string): void {
    const pending = this.pending.get(requestID);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(requestID);
    }
  }

  /**
   * 获取待处理问题数量
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * 关闭管理器，清理所有待处理请求
   */
  close(): void {
    for (const [requestID] of this.pending) {
      this.cancel(requestID);
    }
  }
}
