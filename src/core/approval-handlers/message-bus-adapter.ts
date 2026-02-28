/**
 * MessageBus 适配器
 *
 * 将 MessageBus 包装为 MessagePublisher 接口，实现解耦
 */

import type { MessageBus } from '@/bus/queue';
import type { MessagePublisher } from './types';

/**
 * MessageBus 适配器
 *
 * 实现 MessagePublisher 接口，将调用委托给 MessageBus
 */
export class MessageBusAdapter implements MessagePublisher {
  /**
   * 构造函数
   *
   * @param bus - 消息总线实例
   */
  constructor(private bus: MessageBus) {}

  /**
   * 发布出站消息
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @param content - 消息内容
   */
  async publishOutbound(channel: string, chatId: string, content: string): Promise<void> {
    await this.bus.publishOutbound({ channel, chatId, content });
  }
}
