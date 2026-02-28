/**
 * 渠道基类
 * 
 * 所有聊天渠道的抽象基类
 */

import type { OutboundMessage } from '../bus/types';

/**
 * 基础渠道配置
 */
export interface BaseChannelConfig {
  // 各渠道可以添加自己的配置属性
  [key: string]: any;
}

/**
 * 基础渠道抽象类
 * 
 * 所有渠道必须继承此类并实现抽象方法
 */
export abstract class BaseChannel {
  /**
   * 启动渠道
   */
  abstract start(): Promise<void>;

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
