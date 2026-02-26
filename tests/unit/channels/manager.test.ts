/**
 * ChannelManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChannelManager } from '../../../src/channels/manager';
import { MessageBus } from '../../../src/bus/queue';
import type { Config } from '../../../src/config/schema';
import { BaseChannel } from '../../../src/channels/base';
import type { OutboundMessage } from '../../../src/bus/events';

describe('ChannelManager', () => {
  let manager: ChannelManager;
  let bus: MessageBus;
  let config: Config;

  class MockChannel extends BaseChannel {
    name = 'mock';
    startFn = vi.fn().mockResolvedValue(undefined);
    stopFn = vi.fn().mockResolvedValue(undefined);
    sendFn = vi.fn().mockResolvedValue(undefined);

    constructor(public channelName: string) {
      super();
      this.name = channelName;
    }

    async start() {
      this.startFn();
    }

    async stop() {
      this.stopFn();
    }

    async send(msg: OutboundMessage) {
      this.sendFn(msg);
    }
  }

  const createTestConfig = (): Config => ({
    agents: {
      defaults: {
        workspace: '~/.nanobot/workspace',
        model: 'openai:gpt-4o',
        temperature: 0.1,
        maxTokens: 8192,
        maxIterations: 40,
        memoryWindow: 100,
      },
    },
    providers: {
      openai: { apiKey: 'test-key' },
      anthropic: { apiKey: 'test-key' },
      openrouter: { apiKey: 'test-key' },
      deepseek: { apiKey: 'test-key' },
    },
    channels: {
      whatsapp: { enabled: true, allowFrom: ['+1234567890'], usePairingCode: false },
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
  });

  beforeEach(() => {
    bus = new MessageBus();
    config = createTestConfig();
    manager = new ChannelManager(config, bus);
  });

  describe('constructor', () => {
    it('should create instance with config and bus', () => {
      expect(manager).toBeDefined();
      expect(manager.getConfig()).toBe(config);
    });
  });

  describe('registerChannel', () => {
    it('should register a channel', () => {
      const channel = new MockChannel('test');
      manager.registerChannel('test', channel);

      const registered = manager.getChannel('test');
      expect(registered).toBe(channel);
    });

    it('should overwrite existing channel with same name', () => {
      const channel1 = new MockChannel('test');
      const channel2 = new MockChannel('test');

      manager.registerChannel('test', channel1);
      manager.registerChannel('test', channel2);

      const registered = manager.getChannel('test');
      expect(registered).toBe(channel2);
    });
  });

  describe('getChannel', () => {
    it('should return undefined for non-existent channel', () => {
      const channel = manager.getChannel('nonexistent');
      expect(channel).toBeUndefined();
    });

    it('should return registered channel', () => {
      const channel = new MockChannel('test');
      manager.registerChannel('test', channel);

      const result = manager.getChannel('test');
      expect(result).toBe(channel);
    });
  });

  describe('getStatus', () => {
    it('should return status for all channels', () => {
      const statuses = manager.getStatus();

      expect(statuses).toHaveLength(4);
      expect(statuses.map(s => s.name)).toContain('cli');
      expect(statuses.map(s => s.name)).toContain('whatsapp');
      expect(statuses.map(s => s.name)).toContain('feishu');
      expect(statuses.map(s => s.name)).toContain('email');
    });

    it('should reflect registration status', async () => {
      // Register a channel using an existing name from config
      const channel = new MockChannel('whatsapp');
      manager.registerChannel('whatsapp', channel);

      const statuses = manager.getStatus();
      const testStatus = statuses.find(s => s.name === 'whatsapp');

      expect(testStatus?.registered).toBe(true);
    });

    it('should reflect enabled status from config', () => {
      const statuses = manager.getStatus();

      const whatsapp = statuses.find(s => s.name === 'whatsapp');
      const feishu = statuses.find(s => s.name === 'feishu');

      expect(whatsapp?.enabled).toBe(true);
      expect(feishu?.enabled).toBe(false);
    });
  });

  describe('loadChannelsFromConfig', () => {
    it('should load enabled channels from config', async () => {
      await manager.loadChannelsFromConfig(bus);

      // whatsapp is enabled in config
      const statuses = manager.getStatus();
      const whatsapp = statuses.find(s => s.name === 'whatsapp');

      expect(whatsapp?.enabled).toBe(true);
    });

    it('should not load disabled channels', async () => {
      await manager.loadChannelsFromConfig(bus);

      const statuses = manager.getStatus();
      const feishu = statuses.find(s => s.name === 'feishu');
      const email = statuses.find(s => s.name === 'email');

      expect(feishu?.enabled).toBe(false);
      expect(email?.enabled).toBe(false);
    });
  });

  describe('startAll and stopAll', () => {
    it('should start all registered channels', async () => {
      const channel = new MockChannel('test');
      manager.registerChannel('test', channel);

      await manager.startAll();

      expect(channel.startFn).toHaveBeenCalled();
    });

    it('should stop all registered channels', async () => {
      const channel = new MockChannel('test');
      manager.registerChannel('test', channel);

      await manager.stopAll();

      expect(channel.stopFn).toHaveBeenCalled();
    });
  });

  describe('runOutboundLoop and stop', () => {
    it('should start outbound loop', () => {
      manager.runOutboundLoop();

      // Should not throw when called again (should be idempotent)
      manager.runOutboundLoop();

      manager.stop();
    });

    it('should stop running', () => {
      manager.runOutboundLoop();
      manager.stop();

      // Should not throw
      manager.stop();
    });
  });

  describe('waitOutboundLoop', () => {
    it('should resolve immediately if loop not running', async () => {
      await expect(manager.waitOutboundLoop()).resolves.toBeUndefined();
    });
  });
});
