/**
 * Drizzle 会话管理器测试
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { DrizzleSessionManager } from '../../../packages/main/src/storage/session-drizzle';
import type { SessionMessage } from '@nanobot/shared';
import { rm } from 'fs/promises';
import path from 'path';
import { ensureDir } from '@nanobot/utils';

// 串行运行测试，避免 SQLite 并发冲突
describe.serial('DrizzleSessionManager', () => {
  let sessionManager: DrizzleSessionManager;
  let workspace: string;
  let testCounter = 0;
  const baseDir = path.join(process.cwd(), 'test-workspace-drizzle');

  beforeAll(async () => {
    // 创建基础测试目录
    ensureDir(baseDir);
  });

  afterAll(async () => {
    // 清理基础测试目录
    try {
      await rm(baseDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  beforeEach(async () => {
    // 生成唯一的测试 ID
    testCounter++;
    const uniqueId = `${process.pid}-${testCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    workspace = path.join(baseDir, `test-${uniqueId}`);

    sessionManager = new DrizzleSessionManager(workspace);

    // 初始化
    await sessionManager.init();
  });

  afterEach(async () => {
    // 清理测试工作区
    try {
      await rm(workspace, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('getOrCreate', () => {
    it('should create new session if not exists', async () => {
      const key = 'test:cli:user123';

      const session = await sessionManager.getOrCreate(key);

      expect(session.key).toBe(key);
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeDefined();
    });

    it('should load existing session', async () => {
      const key = 'test:cli:user123';

      // 先创建会话
      const createdSession = await sessionManager.getOrCreate(key);
      createdSession.messages.push({
        role: 'user',
        content: 'First message',
        timestamp: new Date().toISOString(),
      });

      // 修改后不保存，直接重新加载
      sessionManager.invalidate(key);
      const loadedSession = await sessionManager.getOrCreate(key);

      // 应该是空的，因为我们没有保存消息
      expect(loadedSession.key).toBe(key);
      expect(loadedSession.messages).toHaveLength(0);
    });

    it('should cache session', async () => {
      const key = 'test:cli:user123';

      const session1 = await sessionManager.getOrCreate(key);
      const session2 = await sessionManager.getOrCreate(key);

      expect(session1).toBe(session2);
    });

    it('should parse sessionKey correctly', async () => {
      const key = 'telegram:123456789';
      const session = await sessionManager.getOrCreate(key);

      expect(session.key).toBe(key);

      const sessions = await sessionManager.listSessionsByChannel('telegram');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].chatId).toBe('123456789');
    });
  });

  describe('addMessage', () => {
    it('should add message to session', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      const msg: SessionMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      };

      await sessionManager.addMessage(key, msg);

      const retrievedSession = await sessionManager.getOrCreate(key);

      expect(retrievedSession.messages).toHaveLength(1);
      expect(retrievedSession.messages[0]).toEqual(msg);
    });

    it('should update updated timestamp', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

      const oldTimestamp = session.updatedAt;

      // 等待 1ms 确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const msg: SessionMessage = {
        role: 'user',
        content: 'New message',
        timestamp: new Date().toISOString(),
      };

      await sessionManager.addMessage(key, msg);

      const updatedSession = await sessionManager.getOrCreate(key);

      expect(updatedSession.updatedAt).not.toBe(oldTimestamp);
    });

    it('should invalidate cache after adding message', async () => {
      const key = 'test:cli:user123';
      const session1 = await sessionManager.getOrCreate(key);

      const msg: SessionMessage = {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      };

      await sessionManager.addMessage(key, msg);

      const session2 = await sessionManager.getOrCreate(key);

      expect(session1.messages).toHaveLength(0);
      expect(session2.messages).toHaveLength(1);
    });
  });

  describe('getHistory', () => {
    it('should return empty history for new session', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      const history = await sessionManager.getHistory(key, 10);

      expect(history).toEqual([]);
    });

    it('should limit message count', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      // 添加 15 条消息
      for (let i = 0; i < 15; i++) {
        await sessionManager.addMessage(key, {
          role: 'user',
          content: `Message ${i}`,
          timestamp: new Date().toISOString(),
        });
      }

      const history = await sessionManager.getHistory(key, 10);

      expect(history).toHaveLength(10);
      expect(history[0].content).toBe('Message 5'); // 最后 10 条消息中的第一条
      expect(history[9].content).toBe('Message 14'); // 最后 10 条消息中的最后一条
    });

    it('should include both roles', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'User message',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(key, {
        role: 'assistant',
        content: 'Assistant response',
        timestamp: new Date().toISOString(),
      });

      const history = await sessionManager.getHistory(key, 10);

      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should exclude tool messages', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      // 添加 1 条用户消息
      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'User message',
        timestamp: new Date().toISOString(),
      });

      // 添加 1 条工具调用消息
      await sessionManager.addMessage(key, {
        role: 'tool',
        toolCalls: [{ name: 'test_tool', arguments: '{}', id: 'test-id' }],
        timestamp: '2026-02-25T10:30:00.000Z',
      } as SessionMessage);

      const history = await sessionManager.getHistory(key, 10);

      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].toolCalls).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear session messages', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      // 添加一些消息
      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Message 1',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Message 2',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(key, {
        role: 'assistant',
        content: 'Response',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.clear(key);

      const clearedSession = await sessionManager.getOrCreate(key);

      expect(clearedSession.messages).toEqual([]);
      expect(clearedSession.updatedAt).toBeDefined();
    });

    it('should reset lastConsolidated', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

      // 修改 lastConsolidated
      session.lastConsolidated = 10;
      await sessionManager.saveSession(session);

      await sessionManager.clear(key);

      const clearedSession = await sessionManager.getOrCreate(key);

      expect(clearedSession.lastConsolidated).toBe(0);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and messages', async () => {
      const key = 'test:cli:user123';
      await sessionManager.getOrCreate(key);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.deleteSession(key);

      const newSession = await sessionManager.getOrCreate(key);

      expect(newSession.messages).toEqual([]);
    });

    it('should handle non-existent session gracefully', async () => {
      const key = 'test:cli:user456';
      await expect(sessionManager.deleteSession(key)).resolves.toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should return empty list for empty workspace', async () => {
      const sessions = await sessionManager.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should list sessions sorted by updated date', async () => {
      const key1 = 'test:cli:user1';
      await sessionManager.getOrCreate(key1);
      await new Promise(resolve => setTimeout(resolve, 1));

      const key2 = 'test:cli:user2';
      await sessionManager.getOrCreate(key2);

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].key).toBe(key2);
      expect(sessions[1].key).toBe(key1);
    });

    it('should count messages correctly', async () => {
      const key = 'test:cli:user1';
      await sessionManager.getOrCreate(key);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Test',
        timestamp: new Date().toISOString(),
      });

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].messageCount).toBe(1);
    });
  });

  describe('listSessionsByChannel', () => {
    it('should list sessions by channel', async () => {
      // 创建不同渠道的会话
      await sessionManager.getOrCreate('cli:user1');
      await sessionManager.getOrCreate('cli:user2');
      await sessionManager.getOrCreate('telegram:123456');
      await sessionManager.getOrCreate('discord:guild_channel');

      const cliSessions = await sessionManager.listSessionsByChannel('cli');
      const telegramSessions = await sessionManager.listSessionsByChannel('telegram');
      const discordSessions = await sessionManager.listSessionsByChannel('discord');

      expect(cliSessions).toHaveLength(2);
      expect(telegramSessions).toHaveLength(1);
      expect(discordSessions).toHaveLength(1);
    });

    it('should include chatId in results', async () => {
      await sessionManager.getOrCreate('telegram:123456789');

      const sessions = await sessionManager.listSessionsByChannel('telegram');

      expect(sessions[0].chatId).toBe('123456789');
    });
  });

  describe('getOrCreateByChannel', () => {
    it('should get or create session by channel and chatId', async () => {
      const session1 = await sessionManager.getOrCreateByChannel('telegram', '123456');
      const session2 = await sessionManager.getOrCreateByChannel('telegram', '123456');

      expect(session1.key).toBe('telegram:123456');
      expect(session2.key).toBe('telegram:123456');
      expect(session1).toBe(session2); // 同一个实例（缓存）
    });
  });

  describe('getActiveSessions', () => {
    it('should return sessions with recent messages', async () => {
      const key = 'test:cli:active';
      await sessionManager.getOrCreate(key);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Recent message',
        timestamp: new Date().toISOString(),
      });

      const activeSessions = await sessionManager.getActiveSessions(7);

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].key).toBe(key);
    });

    it('should exclude old sessions', async () => {
      const key = 'test:cli:old';
      const session = await sessionManager.getOrCreate(key);

      // 添加一条很久以前的消息
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Old message',
        timestamp: oldDate.toISOString(),
      });

      const activeSessions = await sessionManager.getActiveSessions(7);

      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('getChannelStats', () => {
    it('should return statistics for each channel', async () => {
      // 创建不同渠道的会话
      const cliKey = 'cli:user1';
      const telegramKey = 'telegram:123456';

      await sessionManager.getOrCreate(cliKey);
      await sessionManager.getOrCreate(telegramKey);

      // 添加消息
      await sessionManager.addMessage(cliKey, {
        role: 'user',
        content: 'Message 1',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(cliKey, {
        role: 'assistant',
        content: 'Message 2',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(telegramKey, {
        role: 'user',
        content: 'Message 3',
        timestamp: new Date().toISOString(),
      });

      const stats = await sessionManager.getChannelStats();

      expect(stats).toHaveLength(2);

      const cliStats = stats.find(s => s.channel === 'cli');
      const telegramStats = stats.find(s => s.channel === 'telegram');

      expect(cliStats?.sessionCount).toBe(1);
      expect(cliStats?.messageCount).toBe(2);

      expect(telegramStats?.sessionCount).toBe(1);
      expect(telegramStats?.messageCount).toBe(1);
    });
  });

  describe('saveSession', () => {
    it('should update lastConsolidated', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

      session.lastConsolidated = 5;
      await sessionManager.saveSession(session);

      sessionManager.invalidate(key);
      const updatedSession = await sessionManager.getOrCreate(key);

      expect(updatedSession.lastConsolidated).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle sessionKey with multiple colons', async () => {
      const key = 'discord:guildId:channelId';
      const session = await sessionManager.getOrCreate(key);

      expect(session.key).toBe(key);

      const sessions = await sessionManager.listSessionsByChannel('discord');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].chatId).toBe('guildId:channelId');
    });

    it('should handle complex metadata and parts', async () => {
      const key = 'test:cli:complex';
      await sessionManager.getOrCreate(key);

      const msg: SessionMessage = {
        role: 'user',
        content: 'Complex message',
        timestamp: new Date().toISOString(),
        parts: [
          { type: 'text', text: 'Hello' },
          { type: 'tool-call', toolName: 'test', toolCallId: '123' },
        ],
        metadata: { userId: 'user123', customField: 'value' },
        model: 'gpt-4',
      };

      await sessionManager.addMessage(key, msg);

      const session = await sessionManager.getOrCreate(key);

      expect(session.messages[0].parts).toEqual(msg.parts);
      expect(session.messages[0].metadata).toEqual(msg.metadata);
      expect(session.messages[0].model).toBe('gpt-4');
    });
  });
});
