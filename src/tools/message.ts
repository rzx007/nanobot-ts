/**
 * 消息发送工具
 * 
 * 跨渠道发送消息的工具实现
 */

import { Tool } from './base';
import type { MessageBus } from '../bus';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

/**
 * 消息发送工具
 */
export class MessageTool extends Tool {
  name = 'message';

  description = '发送消息到指定的聊天渠道';

  /** 消息总线 */
  private bus: MessageBus;

  constructor(_config: Config, bus: MessageBus) {
    super();
    this.bus = bus;
  }

  parameters = {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: '目标渠道 (whatsapp, feishu, email, cli)',
      },
      chatId: {
        type: 'string',
        description: '聊天标识 (会话 ID)',
      },
      content: {
        type: 'string',
        description: '消息内容',
      },
    },
    required: ['channel', 'chatId', 'content'],
  };

  /**
   * 发送消息到指定渠道
   * 
   * @param params - 工具参数
   * @returns 发送结果
   */
  async execute(params: {
    channel: string;
    chatId: string;
    content: string;
  }): Promise<string> {
    try {
      const { channel, chatId, content } = params;

      logger.info(`Sending message to ${channel}:${chatId}`);

      // 发布到消息总线
      await this.bus.publishOutbound({
        channel,
        chatId,
        content,
      });

      return `Message sent to ${channel}`;
    } catch (error) {
      const errorMsg = `Send message failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}
