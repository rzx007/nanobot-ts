/**
 * 会话管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../../src/storage/session';
import { Session, SessionMessage } from '../../../src/storage/session';
import { expandHome } from '../../../src/utils/helpers';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../../../src/utils/logger';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let workspace: string;

  beforeEach(async () => {
    workspace = `test-workspace-${Date.now()}`;
    sessionManager = new SessionManager(workspace);

    // 初始化
    await sessionManager.init();
  });

  afterEach(async () => {
    // 清理测试工作区
    try {
      await fs.rm(workspace, { recursive: true, force: true });
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
      expect(session.metadata).toEqual({});
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

      await sessionManager.save(createdSession);
      sessionManager.invalidate(key);

      // 再次获取
      const loadedSession = await sessionManager.getOrCreate(key);

      expect(loadedSession.key).toBe(key);
      expect(loadedSession.messages).toHaveLength(1);
      expect(loadedSession.messages[0]).toEqual({
        role: 'user',
        content: 'First message',
        timestamp: expect.any(String),
      });
    });
  });

  describe('addMessage', () => {
    it('should add message to session', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);
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
  });

  describe('getHistory', () => {
    it('should return empty history for new session', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

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
      const session = await sessionManager.getOrCreate(key);

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
      });

      const history = await sessionManager.getHistory(key, 10);

      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].toolCalls).toBeUndefined();
    });

    it('should drop leading non-user messages', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

      // 添加 1 条工具消息
      await sessionManager.addMessage(key, {
        role: 'tool',
        content: 'Tool result',
        timestamp: new Date().toISOString(),
      });

      // 添加 2 条用户消息
      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'User message 1',
        timestamp: new Date().toISOString(),
      });

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'User message 2',
        timestamp: new Date().toISOString(),
      });

      const history = await sessionManager.getHistory(key, 2);

      // 应该只有 2 条消息，跳过工具消息
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('User message 1');
      expect(history[1].content).toBe('User message 2');
    });
  });

  describe('clear', () => {
    it('should clear session messages', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

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

    it('should keep metadata', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Message',
        timestamp: new Date().toISOString(),
      });

      session.metadata = { customField: 'value' };
      await sessionManager.save(session);

      await sessionManager.clear(key);

      const retrievedSession = await sessionManager.getOrCreate(key);

      expect(retrievedSession.metadata).toEqual({ customField: 'value' });
    });
  });

  describe('deleteSession', () => {
    it('should delete session file', async () => {
      const key = 'test:cli:user123';
      const session = await sessionManager.getOrCreate(key);
      await sessionManager.save(session);

      await sessionManager.deleteSession(key);

      const newSession = await sessionManager.getOrCreate(key);

      expect(newSession.messages).toEqual([]);
      expect(newSession.metadata).toEqual({});
    });

    it('should handle non-existent session gracefully', async () => {
      const key = 'test:cli:user456';
      const result = await sessionManager.deleteSession(key);

      expect(result).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should return empty list for empty workspace', async () => {
      const sessions = await sessionManager.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should list sessions sorted by updated date', async () => {
      const key1 = 'test:cli:user1';
      const session1 = await sessionManager.getOrCreate(key1);
      await sessionManager.save(session1);
      // 等待 1ms 确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1));

      const key2 = 'test:cli:user2';
      const session2 = await sessionManager.getOrCreate(key2);
      await sessionManager.save(session2);
      await new Promise(resolve => setTimeout(resolve, 1));

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
      // key2 应该排在前面，因为它更新时间更晚
      expect(sessions[0].key).toBe(key2);
      expect(sessions[0].messageCount).toBe(0);
      expect(sessions[1].key).toBe(key1);
      expect(sessions[1].messageCount).toBe(0);
      // 验证排序：sessions[0] 应该比 sessions[1] 更新
      expect(new Date(sessions[0].updatedAt).getTime() - new Date(sessions[1].updatedAt).getTime()).toBeGreaterThanOrEqual(0);
    });

    it('should update session after message is added', async () => {
      const key = 'test:cli:user1';
      const session = await sessionManager.getOrCreate(key);
      await sessionManager.save(session);

      const sessions1 = await sessionManager.listSessions();

      expect(sessions1).toHaveLength(1);
      expect(sessions1[0].messageCount).toBe(0);

      await sessionManager.addMessage(key, {
        role: 'user',
        content: 'Test',
        timestamp: new Date().toISOString(),
      });

      const sessions2 = await sessionManager.listSessions();

      expect(sessions2).toHaveLength(1);
      expect(sessions2[0].messageCount).toBe(1);
      expect(sessions2[0].updatedAt).toBeDefined();
      expect(new Date(sessions2[0].updatedAt) - new Date(sessions2[0].updatedAt)).toBeGreaterThanOrEqual(0);
    });
  });
});
