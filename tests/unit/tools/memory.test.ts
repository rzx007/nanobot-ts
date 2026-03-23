/**
 * SearchHistoryTool 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchHistoryTool } from '../../../src/tools/memory';
import type { SessionManager } from '../../../src/storage';

describe('SearchHistoryTool', () => {
  let tool: SearchHistoryTool;
  let mockSessionManager: SessionManager;

  beforeEach(() => {
    tool = new SearchHistoryTool();

    mockSessionManager = {
      db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      },
    } as unknown as SessionManager;

    tool.setSessionManager(mockSessionManager);
  });

  describe('execute', () => {
    it('should return error when session manager is not set', async () => {
      const toolWithoutManager = new SearchHistoryTool();
      const result = await toolWithoutManager.execute({ keyword: 'test' });

      expect(result).toContain('错误：会话管理器未初始化');
    });

    it('should return error when db is not accessible', async () => {
      const managerWithoutDb = {} as SessionManager;
      tool.setSessionManager(managerWithoutDb);

      const result = await tool.execute({ keyword: 'test' });

      expect(result).toContain('错误：无法访问数据库');
    });

    it('should return not found when no results', async () => {
      const result = await tool.execute({ keyword: 'test' });

      expect(result).toContain('未找到包含「test」的历史记录');
    });

    it('should format results correctly', async () => {
      const mockResults = [
        {
          message: {
            role: 'user',
            content: 'Hello world',
            timestamp: '2024-01-01T00:00:00.000Z',
          },
          session: {
            key: 'cli:test',
            channel: 'cli',
            chatId: 'test',
          },
        },
      ];

      (mockSessionManager as any).db.limit.mockResolvedValueOnce(mockResults);

      const result = await tool.execute({ keyword: 'Hello' });

      expect(result).toContain('Hello world');
      expect(result).toContain('cli:test');
    });

    it('should pass keyword parameter correctly', async () => {
      await tool.execute({ keyword: 'test keyword' });

      expect((mockSessionManager as any).db.where).toHaveBeenCalled();
    });

    it('should pass limit parameter correctly', async () => {
      await tool.execute({ keyword: 'test', limit: 10 });

      expect((mockSessionManager as any).db.limit).toHaveBeenCalledWith(10);
    });

    it('should use default limit of 20', async () => {
      await tool.execute({ keyword: 'test' });

      expect((mockSessionManager as any).db.limit).toHaveBeenCalledWith(20);
    });
  });

  describe('parameters', () => {
    it('should require keyword parameter', () => {
      expect(tool.parameters.required).toContain('keyword');
    });

    it('should have optional channel parameter', () => {
      expect(tool.parameters.properties.channel).toBeDefined();
    });

    it('should have optional days parameter', () => {
      expect(tool.parameters.properties.days).toBeDefined();
    });

    it('should have optional limit parameter', () => {
      expect(tool.parameters.properties.limit).toBeDefined();
    });
  });
});
