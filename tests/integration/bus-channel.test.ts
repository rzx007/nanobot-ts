/**
 * MessageBus 与 ChannelManager 集成测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus } from '../../src/bus/queue';
import { ChannelManager } from '../../src/channels/manager';
import type { Config } from '../../src/config/schema';

describe('MessageBus and ChannelManager Integration', () => {
  let bus: MessageBus;
  let channelManager: ChannelManager;
  let config: Config;

  beforeEach(() => {
    bus = new MessageBus();
    config = {
      agents: {
        defaults: {
          workspace: '~/.nanobot/test-workspace',
          model: 'openai:gpt-4o',
          temperature: 0.1,
          maxTokens: 8192,
          maxIterations: 40,
          memoryWindow: 100,
        },
      },
      providers: {
        openai: { apiKey: 'test-key', apiBase: 'https://api.openai.com/v1' },
        anthropic: { apiKey: 'test-key' },
        openrouter: { apiKey: 'test-key' },
        deepseek: { apiKey: 'test-key' },
      },
      channels: {
        whatsapp: { enabled: false, allowFrom: [], usePairingCode: false },
        feishu: {
          enabled: false,
          appId: '',
          appSecret: '',
          encryptKey: '',
          verificationToken: '',
          allowFrom: [],
        },
        email: {
          enabled: false,
          consentGranted: false,
          imapHost: '',
          imapPort: 993,
          imapUsername: '',
          imapPassword: '',
          imapMailbox: 'INBOX',
          smtpHost: '',
          smtpPort: 587,
          smtpUsername: '',
          smtpPassword: '',
          fromAddress: 'test@example.com',
          allowFrom: [],
          autoReplyEnabled: true,
        },
      },
      tools: {
        restrictToWorkspace: false,
        exec: { timeout: 60, allowedCommands: [] },
        web: { search: { apiKey: '' } },
      },
    };

    channelManager = new ChannelManager(config, bus);
  });

  afterEach(async () => {
    channelManager.stop();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Inbound Message Flow', () => {
    it('should publish and consume inbound messages', async () => {
      const testMessage = {
        channel: 'test' as const,
        senderId: 'user123',
        chatId: 'test-chat',
        content: 'Hello, World!',
        timestamp: new Date(),
      };

      const consumedPromise = bus.consumeInbound();
      await bus.publishInbound(testMessage);

      const consumedMessage = await consumedPromise;
      expect(consumedMessage).toMatchObject({
        channel: 'test',
        senderId: 'user123',
        chatId: 'test-chat',
        content: 'Hello, World!',
      });
    });

    it('should handle multiple inbound messages in order', async () => {
      const messages = [
        {
          channel: 'test' as const,
          senderId: 'user1',
          chatId: 'chat1',
          content: 'Message 1',
          timestamp: new Date(),
        },
        {
          channel: 'test' as const,
          senderId: 'user1',
          chatId: 'chat1',
          content: 'Message 2',
          timestamp: new Date(),
        },
        {
          channel: 'test' as const,
          senderId: 'user1',
          chatId: 'chat1',
          content: 'Message 3',
          timestamp: new Date(),
        },
      ];

      const publishPromises = messages.map(msg => bus.publishInbound(msg));
      await Promise.all(publishPromises);

      const consumedMessages: any[] = [];
      for (let i = 0; i < messages.length; i++) {
        const msg = await bus.consumeInbound();
        consumedMessages.push(msg);
      }

      expect(consumedMessages.map((m: any) => m.content)).toEqual([
        'Message 1',
        'Message 2',
        'Message 3',
      ]);
    });
  });

  describe('Outbound Message Flow', () => {
    it('should publish and consume outbound messages', async () => {
      const testMessage = {
        channel: 'test' as const,
        senderId: 'agent',
        chatId: 'test-chat',
        content: 'Response message',
        timestamp: new Date(),
      };

      const consumedPromise = bus.consumeOutbound();
      await bus.publishOutbound(testMessage);

      const consumedMessage = await consumedPromise;
      expect(consumedMessage).toMatchObject({
        channel: 'test',
        senderId: 'agent',
        chatId: 'test-chat',
        content: 'Response message',
      });
    });
  });

  describe('ChannelManager Integration', () => {
    it('should dispatch outbound messages to registered channels', async () => {
      class MockChannel {
        name = 'mock';
        messages: any[] = [];
        async start(): Promise<void> {}
        async stop(): Promise<void> {}
        async send(msg: any): Promise<void> {
          this.messages.push(msg);
        }
      }

      const mockChannel = new MockChannel();
      channelManager.registerChannel('mock', mockChannel as any);

      channelManager.runOutboundLoop();

      const outboundMessage = {
        channel: 'mock',
        senderId: 'agent',
        chatId: 'test-chat',
        content: 'Test message',
        timestamp: new Date(),
      };

      await bus.publishOutbound(outboundMessage);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockChannel.messages).toHaveLength(1);
      expect(mockChannel.messages[0]).toMatchObject({
        channel: 'mock',
        content: 'Test message',
      });

      channelManager.stop();
    });

    it('should handle unregistered channels gracefully', async () => {
      const outboundMessage = {
        channel: 'nonexistent',
        senderId: 'agent',
        chatId: 'test-chat',
        content: 'Test message',
        timestamp: new Date(),
      };

      await bus.publishOutbound(outboundMessage);

      const consumedMessage = await bus.consumeOutbound();
      expect(consumedMessage).toMatchObject({
        channel: 'nonexistent',
        content: 'Test message',
      });
    });
  });
});
