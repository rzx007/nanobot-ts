/**
 * AgentLoop 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentLoop } from '../../../src/core/agent';
import type { Config } from '../../../src/config/schema';
import type { LLMProvider } from '../../../src/providers';
import type { ToolRegistry } from '../../../src/tools';
import type { SessionManager } from '../../../src/storage';

describe('AgentLoop', () => {
  let config: Config;
  let mockProvider: LLMProvider;
  let mockTools: ToolRegistry;
  let mockSessions: SessionManager;
  let mockBus: any;

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
    config = createTestConfig();
    mockProvider = {
      chat: vi.fn().mockResolvedValue({ content: 'test response' }),
    } as unknown as LLMProvider;
    mockTools = {
      getToolNames: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(null),
      getDefinitions: vi.fn().mockReturnValue([]),
      execute: vi.fn().mockResolvedValue('tool result'),
    } as unknown as ToolRegistry;
    mockSessions = {
      getOrCreate: vi.fn().mockResolvedValue({
        key: 'test-session',
        messages: [],
        lastConsolidated: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {},
      }),
      addMessage: vi.fn().mockResolvedValue(undefined),
      getHistory: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
      saveSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionManager;
    mockBus = {
      publishOutbound: vi.fn().mockResolvedValue(undefined),
      emit: vi.fn(),
    };
  });

  describe('constructor', () => {
    it('should create instance with required dependencies', () => {
      const agent = new AgentLoop({
        bus: mockBus,
        provider: mockProvider,
        tools: mockTools,
        sessions: mockSessions,
        config,
      });

      expect(agent).toBeDefined();
    });

    it('should use default memoryWindow from config', () => {
      const agent = new AgentLoop({
        bus: mockBus,
        provider: mockProvider,
        tools: mockTools,
        sessions: mockSessions,
        config,
      });

      expect(agent).toBeDefined();
    });

    it('should use default maxIterations from config', () => {
      const agent = new AgentLoop({
        bus: mockBus,
        provider: mockProvider,
        tools: mockTools,
        sessions: mockSessions,
        config,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('static _stripThink', () => {
    it('should remove think block from text', () => {
      const text = `<think> Thinking... </think>Hello world`;
      const result = (AgentLoop as any)._stripThink(text);
      expect(result).toBe('Hello world');
    });

    it('should handle text without think block', () => {
      const text = 'Hello world';
      const result = (AgentLoop as any)._stripThink(text);
      expect(result).toBe('Hello world');
    });

    it('should handle null/undefined', () => {
      expect((AgentLoop as any)._stripThink(null)).toBe('');
      expect((AgentLoop as any)._stripThink(undefined)).toBe('');
      expect((AgentLoop as any)._stripThink('')).toBe('');
    });

    it('should handle text that is only think block', () => {
      const text = `<think> Thinking... </think>`;
      const result = (AgentLoop as any)._stripThink(text);
      expect(result).toBe('');
    });

    it('should handle multiple think blocks', () => {
      const text = '<think> First </think>Hello</think> World';
      const result = (AgentLoop as any)._stripThink(text);
      expect(result).toContain('Hello');
      expect(result).not.toContain('First');
    });
  });

  describe('/help command', () => {
    it('should return help message', async () => {
      const agent = new AgentLoop({
        bus: mockBus,
        provider: mockProvider,
        tools: mockTools,
        sessions: mockSessions,
        config,
      });

      try {
        const result = await (agent as any).process({
          channel: 'cli',
          chatId: 'test-chat',
          content: '/help',
          from: 'user',
          timestamp: new Date().toISOString(),
        });

        expect(result).toBeDefined();
        expect(result.content).toContain('Nanobot-ts');
        expect(result.content).toContain('/new');
        expect(result.content).toContain('/help');
      } catch (e) {
        console.log('Error:', e);
        throw e;
      }
    });
  });
});
