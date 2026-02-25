/**
 * 消息总线
 * 
 * 异步消息队列系统，解耦渠道和 Agent 处理
 * 使用 EventEmitter 实现发布-订阅模式
 */

import { EventEmitter } from 'eventemitter3';
import type {
  InboundMessage,
  OutboundMessage,
} from './events';

/**
 * 消息总线事件
 */
interface MessageBusEvents {
  /** 入站消息事件 */
  inbound: (msg: InboundMessage) => void;

  /** 出站消息事件 */
  outbound: (msg: OutboundMessage) => void;
}

/**
 * 消息总线
 * 
 * 负责消息的发布和消费，实现异步队列机制
 */
export class MessageBus extends EventEmitter<MessageBusEvents> {
  /** 入站消息队列 */
  private readonly inboundQueue: InboundMessage[] = [];

  /** 出站消息队列 */
  private readonly outboundQueue: OutboundMessage[] = [];

  /** 入站消费者队列 (Promise resolve 函数) */
  private readonly inboundConsumers: Array<(msg: InboundMessage) => void> = [];

  /** 出站消费者队列 (Promise resolve 函数) */
  private readonly outboundConsumers: Array<(msg: OutboundMessage) => void> = [];

  /**
   * 发布入站消息
   * 
   * @param msg - 入站消息
   */
  async publishInbound(msg: InboundMessage): Promise<void> {
    // 添加到队列
    this.inboundQueue.push(msg);

    // 触发事件
    this.emit('inbound', msg);

    // 如果有等待的消费者，立即处理
    if (this.inboundConsumers.length > 0) {
      const consumer = this.inboundConsumers.shift()!;
      const nextMsg = this.inboundQueue.shift()!;
      consumer(nextMsg);
    }
  }

  /**
   * 消费入站消息 (阻塞直到有消息)
   * 
   * @returns 入站消息
   */
  async consumeInbound(): Promise<InboundMessage> {
    // 如果队列中有消息，立即返回
    if (this.inboundQueue.length > 0) {
      return this.inboundQueue.shift()!;
    }

    // 等待新消息
    return new Promise((resolve) => {
      this.inboundConsumers.push(resolve);
    });
  }

  /**
   * 发布出站消息
   * 
   * @param msg - 出站消息
   */
  async publishOutbound(msg: OutboundMessage): Promise<void> {
    // 添加到队列
    this.outboundQueue.push(msg);

    // 触发事件
    this.emit('outbound', msg);

    // 如果有等待的消费者，立即处理
    if (this.outboundConsumers.length > 0) {
      const consumer = this.outboundConsumers.shift()!;
      const nextMsg = this.outboundQueue.shift()!;
      consumer(nextMsg);
    }
  }

  /**
   * 消费出站消息
   * 
   * @returns 出站消息
   */
  async consumeOutbound(): Promise<OutboundMessage> {
    // 如果队列中有消息，立即返回
    if (this.outboundQueue.length > 0) {
      return this.outboundQueue.shift()!;
    }

    // 等待新消息
    return new Promise((resolve) => {
      this.outboundConsumers.push(resolve);
    });
  }

  /**
   * 获取队列状态 (用于调试)
   * 
   * @returns 队列状态信息
   */
  getStatus(): {
    inboundQueueLength: number;
    outboundQueueLength: number;
    inboundConsumersLength: number;
    outboundConsumersLength: number;
  } {
    return {
      inboundQueueLength: this.inboundQueue.length,
      outboundQueueLength: this.outboundQueue.length,
      inboundConsumersLength: this.inboundConsumers.length,
      outboundConsumersLength: this.outboundConsumers.length,
    };
  }
}
