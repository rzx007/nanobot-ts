/**
 * SubagentWorker 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubagentWorker } from '../../../src/core/subagent/worker';
import type {
  SubagentWorkerConfig,
  SubagentTask,
  SubagentResult,
} from '../../../src/core/subagent/types';

describe('SubagentWorker', () => {
  let worker: SubagentWorker;
  let mockConfig: SubagentWorkerConfig;

  beforeEach(() => {
    mockConfig = {
      provider: {
        chat: vi.fn().mockResolvedValue({
          content: 'Test response',
          toolCalls: [],
        }),
      },
      tools: {
        getAllTools: vi.fn(() => ({
          testTool: { toSchema: vi.fn(() => ({ type: 'function' })) },
          spawn: { toSchema: vi.fn(() => ({ type: 'function' })) },
          message: { toSchema: vi.fn(() => ({ type: 'function' })) },
        })),
        getToolNames: vi.fn(() => ['testTool', 'spawn', 'message']),
      },
      workspace: '/tmp/test-workspace',
      maxIterations: 15,
      timeout: 300,
    };

    worker = new SubagentWorker(mockConfig);
  });

  describe('execute', () => {
    it('should execute task and return completed result', async () => {
      const taskData: SubagentTask = {
        taskId: 'test-task-123',
        task: 'Test task description',
        label: 'Test Task',
        originChannel: 'cli',
        originChatId: 'direct',
        sessionKey: 'cli:direct',
        status: 'pending',
        createdAt: new Date(),
      };

      const result = await worker.execute(taskData);

      expect(result).toBeDefined();
      expect(result.taskId).toBe('test-task-123');
      expect(result.status).toBe('completed');
      expect(result.result).toBe('Test response');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should handle errors and return failed result', async () => {
      const taskData: SubagentTask = {
        taskId: 'test-task-error',
        task: 'Test task that will fail',
        originChannel: 'cli',
        originChatId: 'direct',
        sessionKey: 'cli:direct',
        status: 'pending',
        createdAt: new Date(),
      };

      mockConfig.provider.chat = vi.fn().mockRejectedValue(new Error('LLM failed'));

      const result = await worker.execute(taskData);

      expect(result).toBeDefined();
      expect(result.taskId).toBe('test-task-error');
      expect(result.status).toBe('failed');
      expect(result.error).toContain('LLM failed');
    });
  });
});
