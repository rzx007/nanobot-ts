/**
 * 渠道管理器
 * 按 config 加载渠道，startAll 时传入 onInbound 回调；出站由上层循环调用 dispatchOutbound
 */

import type { BaseChannel, ChannelStartOptions } from './base';
import type { Config } from '@nanobot/shared';
import type { OutboundMessage } from '@nanobot/shared';
import { logger } from '@nanobot/logger';

/**
 * 渠道管理器
 * 负责渠道的注册、启停；入站通过 startAll({ onInbound }) 注入，出站由上层循环调用 dispatchOutbound
 */
export class ChannelManager {
  private readonly channels = new Map<string, BaseChannel>();

  constructor(private readonly config: Config) {}

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
   * 按 config.channels 加载并注册已启用的渠道（WhatsApp、Feishu、Email）
   * 单个渠道依赖缺失时只打 log 不抛错。
   */
  async loadChannelsFromConfig(): Promise<void> {
    const { whatsapp, feishu, email } = this.config.channels;

    if (whatsapp.enabled) {
      try {
        const { WhatsAppChannel } = await import('./whatsapp');
        this.registerChannel('whatsapp', new WhatsAppChannel(whatsapp));
      } catch (err) {
        logger.warn({ err, name: 'whatsapp' }, 'Channel not available (missing dependency?)');
      }
    }
    if (feishu.enabled && feishu.appId && feishu.appSecret) {
      try {
        const { FeishuChannel } = await import('./feishu');
        this.registerChannel('feishu', new FeishuChannel(feishu));
      } catch (err) {
        logger.warn({ err, name: 'feishu' }, 'Channel not available (missing dependency?)');
      }
    }
    if (
      email.enabled &&
      email.consentGranted &&
      email.imapHost &&
      email.imapUsername &&
      email.smtpHost &&
      email.smtpUsername &&
      email.fromAddress
    ) {
      try {
        const { EmailChannel } = await import('./email');
        this.registerChannel('email', new EmailChannel(email));
      } catch (err) {
        logger.warn({ err, name: 'email' }, 'Channel not available (missing dependency?)');
      }
    }
  }

  /**
   * 启动所有渠道，传入 onInbound 回调（由上层如 gateway 接 bus.publishInbound）
   */
  async startAll(options: ChannelStartOptions): Promise<void> {
    for (const [name, channel] of this.channels) {
      try {
        await channel.start(options);
        logger.info({ name }, 'Channel started');
      } catch (err) {
        logger.error({ err, name }, 'Channel start failed');
      }
    }
  }

  /**
   * 分发一条出站消息到对应渠道（由上层出站循环调用）
   */
  async dispatchOutbound(msg: OutboundMessage): Promise<void> {
    const channel = this.channels.get(msg.channel);
    if (channel) {
      await channel.send(msg);
    } else {
      logger.warn({ channel: msg.channel }, 'No channel registered for outbound message');
    }
  }

  /**
   * 停止所有渠道
   */
  async stopAll(): Promise<void> {
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
   * 停止（停止所有渠道），供 gateway 等 onExit 调用
   */
  async stop(): Promise<void> {
    await this.stopAll();
  }

  /**
   * 获取渠道状态
   */
  getStatus(): Array<{ name: string; registered: boolean; enabled: boolean }> {
    const { whatsapp, feishu, email } = this.config.channels;

    return [
      { name: 'cli', registered: this.channels.has('cli'), enabled: true },
      { name: 'whatsapp', registered: this.channels.has('whatsapp'), enabled: whatsapp.enabled },
      {
        name: 'feishu',
        registered: this.channels.has('feishu'),
        enabled: feishu.enabled && !!feishu.appId,
      },
      {
        name: 'email',
        registered: this.channels.has('email'),
        enabled: email.enabled && email.consentGranted,
      },
    ];
  }
}
