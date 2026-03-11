/**
 * 渠道基类
 *
 * 所有聊天渠道的抽象基类
 */

import type { InboundMessage, OutboundMessage } from '@nanobot/shared';

/**
 * 基础渠道配置
 */
export interface BaseChannelConfig {
  // 各渠道可以添加自己的配置属性
  [key: string]: any;
}

/**
 * 渠道启动选项，由 ChannelManager 在 startAll 时传入
 */
export interface ChannelStartOptions {
  /** 入站消息回调，渠道收到消息时调用，由上层（如 gateway）接 bus.publishInbound */
  onInbound?: (msg: InboundMessage) => void | Promise<void>;
}

/**
 * 基础渠道抽象类
 *
 * 所有渠道必须继承此类并实现抽象方法
 */
export abstract class BaseChannel {
  /**
   * 启动渠道
   * @param options - 可选，含 onInbound 回调，由 ChannelManager.startAll 传入
   */
  abstract start(options?: ChannelStartOptions): Promise<void>;

  /**
   * 停止渠道
   */
  abstract stop(): Promise<void>;

  /**
   * 发送消息
   *
   * @param msg - 出站消息
   */
  abstract send(msg: OutboundMessage): Promise<void>;
}
