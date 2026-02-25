/**
 * CLI 渠道
 * 
 * 直接命令行交互的渠道实现
 */

import type { InboundMessage } from '../bus/events';
import type { BaseChannelConfig, BaseChannel } from './base';
import { logger } from '../utils/logger';

/**
 * CLI 渠道配置
 */
export interface CLIConfig extends BaseChannelConfig {
  // CLI 渠道不需要额外的配置选项
}

/**
 * CLI 渠道
 * 
 * 用于直接命令行交互的渠道
 */
export class CLIChannel implements BaseChannel {
  /** 配置 */
  readonly config: CLIConfig;

  /** 消息总线 */
  private bus: any;

  /** 消息回调 (供子类或扩展使用) */
  protected messageCallback: ((msg: InboundMessage) => void) | null = null;

  /**
   * 构造函数
   * 
   * @param config - 配置对象
   * @param bus - 消息总线
   */
  constructor(config: CLIConfig, bus: any) {
    this.config = config;
    this.bus = bus;
  }

  /**
   * 设置消息回调
   * 
   * @param callback - 消息回调函数
   */
  setMessageCallback(callback: (msg: InboundMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * 启动 CLI 渠道
   */
  async start(): Promise<void> {
    logger.info('CLI channel started');
  }

  /**
   * 停止 CLI 渠道
   */
  async stop(): Promise<void> {
    logger.info('CLI channel stopped');
  }

  /**
   * 发送消息 (在 CLI 中直接打印)
   * 
   * @param msg - 出站消息
   */
  async send(msg: any): Promise<void> {
    if (msg?.content != null) {
      console.log('\nBot>', msg.content);
    }
  }

  /**
   * 发送用户消息到总线
   * 
   * @param content - 用户消息内容
   * @param callback - 响应回调
   */
  async sendUserMessage(
    content: string,
    callback?: (response: string) => void
  ): Promise<void> {
    const msg: InboundMessage = {
      channel: 'cli',
      senderId: 'cli',
      chatId: 'direct',
      content,
      timestamp: new Date(),
    };

    // 设置响应回调
    if (callback) {
      // 在实际实现中，这里需要支持回调
      // 暂时不实现
    }

    // 发布到消息总线
    await this.bus.publishInbound(msg);

    logger.info(`[user]: ${content}`);
  }
}
