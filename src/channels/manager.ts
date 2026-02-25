/**
 * 渠道管理器
 * 按 config 加载渠道，消费 outbound 并分发到各渠道的 send()
 */

import type { OutboundMessage } from '../bus/events';
import type { BaseChannel } from './base';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';

export interface MessageBusLike {
  consumeOutbound(): Promise<OutboundMessage>;
}

/**
 * 渠道管理器
 * 负责渠道的注册、启停，以及出站消息的消费与分发
 */
export class ChannelManager {
  private readonly channels = new Map<string, BaseChannel>();
  private running = false;
  private outboundLoopPromise: Promise<void> | null = null;

  constructor(
    private readonly config: Config,
    private readonly bus: MessageBusLike
  ) {}

  /** 获取配置（供按 config.channels 加载渠道时使用） */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 注册渠道
   */
  registerChannel(name: string, channel: BaseChannel): void {
    if (this.channels.has(name)) {
      logger.warn({ name }, 'Channel already registered, overwriting');
    }
    this.channels.set(name, channel);
    logger.info({ name }, 'Channel registered');
  }

  /**
   * 获取已注册的渠道
   */
  getChannel(name: string): BaseChannel | undefined {
    return this.channels.get(name);
  }

  /**
   * 启动所有渠道
   */
  async startAll(): Promise<void> {
    for (const [name, channel] of this.channels) {
      try {
        await channel.start();
        logger.info({ name }, 'Channel started');
      } catch (err) {
        logger.error({ err, name }, 'Channel start failed');
      }
    }
  }

  /**
   * 停止所有渠道
   */
  async stopAll(): Promise<void> {
    this.running = false;
    for (const [name, channel] of this.channels) {
      try {
        await channel.stop();
        logger.info({ name }, 'Channel stopped');
      } catch (err) {
        logger.error({ err, name }, 'Channel stop failed');
      }
    }
  }

  /**
   * 运行出站消费循环：从 bus 取 outbound，按 channel 分发给对应渠道的 send()
   */
  runOutboundLoop(): void {
    if (this.outboundLoopPromise) {
      logger.warn('Outbound loop already running');
      return;
    }
    this.running = true;
    this.outboundLoopPromise = this._outboundLoop();
  }

  private async _outboundLoop(): Promise<void> {
    while (this.running) {
      try {
        const msg = await this.bus.consumeOutbound();
        const channel = this.channels.get(msg.channel);
        if (channel) {
          await channel.send(msg);
        } else {
          logger.warn({ channel: msg.channel }, 'No channel registered for outbound message');
        }
      } catch (err) {
        if (this.running) {
          logger.error({ err }, 'Outbound dispatch error');
        }
      }
    }
  }

  /**
   * 等待出站循环结束（用于 graceful shutdown）
   */
  async waitOutboundLoop(): Promise<void> {
    if (this.outboundLoopPromise) {
      await this.outboundLoopPromise;
    }
  }

  /**
   * 停止运行（停止出站循环）
   */
  stop(): void {
    this.running = false;
  }
}
