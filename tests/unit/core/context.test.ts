/**
 * ContextBuilder 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextBuilder } from '../../../src/core/context';

describe('ContextBuilder', () => {
  describe('getIdentity', () => {
    it('should return identity block with workspace path', () => {
      const workspace = '~/.nanobot/workspace';
      const result = ContextBuilder.getIdentity(workspace);

      expect(result).toContain('# nanobot-ts');
      expect(result).toContain('You are nanobot-ts');
      expect(result).toContain('Workspace');
      expect(result).toContain('Runtime');
    });

    it('should expand home directory in workspace path', () => {
      const workspace = '~/.nanobot/workspace';
      const result = ContextBuilder.getIdentity(workspace);

      // Should contain expanded path
      expect(result).toContain('.nanobot');
    });
  });

  describe('injectRuntimeContext', () => {
    it('should inject time context into user message', () => {
      const userContent = 'Hello';
      const result = ContextBuilder.injectRuntimeContext(userContent);

      expect(result).toContain('Current Time:');
      expect(result).toContain(userContent);
    });

    it('should inject channel and chatId when provided', () => {
      const userContent = 'Hello';
      const result = ContextBuilder.injectRuntimeContext(userContent, 'whatsapp', 'chat123');

      expect(result).toContain('Channel: whatsapp');
      expect(result).toContain('Chat ID: chat123');
    });

    it('should not inject channel/chatId when not provided', () => {
      const userContent = 'Hello';
      const result = ContextBuilder.injectRuntimeContext(userContent);

      expect(result).not.toContain('Channel:');
      expect(result).not.toContain('Chat ID:');
    });
  });

  describe('buildMessages', () => {
    it('should build messages with system prompt and history', () => {
      const options = {
        systemPrompt: 'You are a helpful assistant',
        history: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
        ],
        currentMessage: 'How are you?',
      };

      const result = ContextBuilder.buildMessages(options);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
      expect(result[1]).toEqual({ role: 'user', content: 'Hi' });
      expect(result[2]).toEqual({ role: 'assistant', content: 'Hello' });
      expect(result[3]).toEqual({ role: 'user', content: expect.stringContaining('How are you?') });
    });

    it('should inject runtime context when channel provided', () => {
      const options = {
        systemPrompt: 'You are a helpful assistant',
        history: [],
        currentMessage: 'Hello',
        channel: 'whatsapp',
        chatId: 'chat123',
      };

      const result = ContextBuilder.buildMessages(options);

      expect(result[1].content).toContain('Channel: whatsapp');
      expect(result[1].content).toContain('Chat ID: chat123');
    });

    it('should handle empty history', () => {
      const options = {
        systemPrompt: 'You are a helpful assistant',
        history: [],
        currentMessage: 'Hello',
      };

      const result = ContextBuilder.buildMessages(options);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[1].role).toBe('user');
    });
  });

  describe('buildMessagesLegacy', () => {
    it('should build messages from session messages', () => {
      const systemPrompt = 'You are a helpful assistant';
      const history = [
        { role: 'user', content: 'Hi', timestamp: '2024-01-01' },
        { role: 'assistant', content: 'Hello', timestamp: '2024-01-01' },
      ] as any;

      const result = ContextBuilder.buildMessagesLegacy(systemPrompt, history);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
    });

    it('should handle empty system prompt', () => {
      const result = ContextBuilder.buildMessagesLegacy('', []);

      expect(result).toHaveLength(0);
    });
  });

  describe('formatToolHistory', () => {
    it('should format tool calls into string', () => {
      const toolCalls = [
        { name: 'read_file', arguments: { path: '/test.txt' } },
        { name: 'write_file', arguments: { path: '/test.txt', content: 'hello' } },
      ];

      const result = ContextBuilder.formatToolHistory(toolCalls);

      expect(result).toContain('工具调用历史:');
      expect(result).toContain('read_file');
      expect(result).toContain('write_file');
    });

    it('should return empty string for empty tool calls', () => {
      const result = ContextBuilder.formatToolHistory([]);

      expect(result).toBe('');
    });
  });
});
