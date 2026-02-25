/**
 * 消息总线测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBus } from '../../../src/bus/queue';
import type { InboundMessage, OutboundMessage } from '../../../src/bus/events';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  afterEach(async () => {
    // 清理任何挂起的事件监听器
    bus.removeAllListeners();
  });

  describe('publishInbound', () => {
    it('should add message to queue', async () => {
      const msg: InboundMessage = {
        channel: 'test',
        senderId: 'user1',
        chatId: '123',
        content: 'hello',
        timestamp: new Date(),
      };

      await bus.publishInbound(msg);
      const result = await bus.consumeInbound();

      expect(result).toEqual(msg);
    });

    it('should handle concurrent publishes', async () => {
      const msgs = Array.from({ length: 10 }, (_, i) => ({
        channel: 'test',
        senderId: `user${i}`,
        chatId: `${i}`,
        content: `message ${i}`,
        timestamp: new Date(),
      }));

      await Promise.all(msgs.map((m) => bus.publishInbound(m)));

      for (const msg of msgs) {
        const result = await bus.consumeInbound();
        expect(result.senderId).toBe(msg.senderId);
      }
    });

    it('should emit inbound event', async () => {
      const msg: InboundMessage = {
        channel: 'test',
        senderId: 'user1',
        chatId: '123',
        content: 'hello',
        timestamp: new Date(),
      };

      let receivedMessage: InboundMessage | null = null;
      bus.on('inbound', (data) => {
        receivedMessage = data;
      });

      await bus.publishInbound(msg);

      expect(receivedMessage).toEqual(msg);
    });
  });

  describe('publishOutbound', () => {
    it('should add message to queue', async () => {
      const msg: OutboundMessage = {
        channel: 'test',
        chatId: '123',
        content: 'response',
      };

      await bus.publishOutbound(msg);
      const result = await bus.consumeOutbound();

      expect(result).toEqual(msg);
    });

    it('should emit outbound event', async () => {
      const msg: OutboundMessage = {
        channel: 'test',
        chatId: '123',
        content: 'response',
      };

      let receivedMessage: OutboundMessage | null = null;
      bus.on('outbound', (data) => {
        receivedMessage = data;
      });

      await bus.publishOutbound(msg);

      expect(receivedMessage).toEqual(msg);
    });
  });

  describe('consumeInbound', () => {
    it('should wait for message if queue is empty', async () => {
      const promise = bus.consumeInbound();
      const msg: InboundMessage = {
        channel: 'test',
        senderId: 'user1',
        chatId: '123',
        content: 'hello',
        timestamp: new Date(),
      };

      // 先发布，确保消费者已注册
      bus.on('inbound', () => {});
      setTimeout(() => bus.publishInbound(msg), 100);
      const result = await promise;

      expect(result).toEqual(msg);
    });
  });

  describe('getStatus', () => {
    it('should return correct queue status', async () => {
      const msg: InboundMessage = {
        channel: 'test',
        senderId: 'user1',
        chatId: '123',
        content: 'hello',
        timestamp: new Date(),
      };

      await bus.publishInbound(msg);
      await bus.consumeInbound(); // 消费消息

      const status = bus.getStatus();

      expect(status.inboundQueueLength).toBe(0); // 已被消费
      expect(status.outboundQueueLength).toBe(0);
      expect(status.inboundConsumersLength).toBe(0);
      expect(status.outboundConsumersLength).toBe(0);
    });
  });
});
