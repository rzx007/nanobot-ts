/**
 * SubagentManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentManager } from '../../../src/core/subagent/manager';
import type {
  SubagentTask,
  SubagentResult,
  SubagentManagerConfig,
} from '../../../src/core/subagent/types';
import { MessageBus } from '../../../src/bus/queue';

describe('SubagentManager', () => {
  let manager: SubagentManager;
  let bus: MessageBus;
  let mockProvider: any;
  let mockTools: any;

  beforeEach(() => {
    bus = new MessageBus();
    mockProvider = {
      chat: vi.fn(),
    };
    mockTools = {
      getToolNames: vi.fn(() => []),
    };

    const config: SubagentManagerConfig = {
      bus,
      provider: mockProvider,
      tools: mockTools,
      workspace: '/tmp/test-workspace',
      subagentConfig: {
        enabled: true,
        mode: 'embedded',
        concurrency: 1,
        maxIterations: 15,
        timeout: 300,
        dataPath: '/tmp/test-bunqueue.db',
      },
    };

    manager = new SubagentManager(config);
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('initialize', () => {
    it('should initialize successfully in embedded mode', async () => {
      await manager.initialize();

      const mode = manager.getMode();
      expect(mode).toBe('embedded');
    });

    it('should not initialize when subagent is disabled', async () => {
      const config: SubagentManagerConfig = {
        bus,
        provider: mockProvider,
        tools: mockTools,
        workspace: '/tmp/test-workspace',
        subagentConfig: {
          enabled: false,
          mode: 'embedded',
          concurrency: 1,
          maxIterations: 15,
          timeout: 300,
          dataPath: '/tmp/test-bunqueue.db',
        },
      };

      const disabledManager = new SubagentManager(config);
      await disabledManager.initialize();

      expect(disabledManager.getMode()).toBe('embedded');
    });
  });

  describe('spawn', () => {
    it('should spawn a task successfully', async () => {
      await manager.initialize();

      const result = await manager.spawn('Test task', {
        label: 'test-label',
        originChannel: 'test-channel',
        originChatId: 'test-chat',
        sessionKey: 'test-channel:test-chat',
      });

      expect(result).toContain('started');
      expect(result).toContain('id:');
    });

    it('should return error message when subagent is disabled', async () => {
      const config: SubagentManagerConfig = {
        bus,
        provider: mockProvider,
        tools: mockTools,
        workspace: '/tmp/test-workspace',
        subagentConfig: {
          enabled: false,
          mode: 'embedded',
          concurrency: 1,
          maxIterations: 15,
          timeout: 300,
          dataPath: '/tmp/test-bunqueue.db',
        },
      };

      const disabledManager = new SubagentManager(config);
      const result = await disabledManager.spawn('Test task');

      expect(result).toContain('disabled');
    });

    it('should use default values for optional parameters', async () => {
      await manager.initialize();

      const result = await manager.spawn('Test task');

      expect(result).toContain('started');
    });
  });

  describe('cancel', () => {
    it('should cancel a running task', async () => {
      await manager.initialize();

      const spawnResult = await manager.spawn('Test task');
      const taskIdMatch = spawnResult.match(/id: ([a-z0-9]+)/i);
      const taskId = taskIdMatch?.[1];

      if (!taskId) {
        throw new Error('Failed to extract task ID');
      }

      const cancelResult = await manager.cancel(taskId);

      expect(cancelResult).toContain('cancelled');
    });

    it('should return error for non-existent task', async () => {
      await manager.initialize();

      const result = await manager.cancel('non-existent-task-id');

      expect(result).toContain('No running task found');
    });
  });

  describe('getRunningCount', () => {
    it('should return the number of running tasks', async () => {
      await manager.initialize();

      const count = await manager.getRunningCount();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMode', () => {
    it('should return the current mode', async () => {
      await manager.initialize();

      const mode = manager.getMode();

      expect(mode).toBe('embedded');
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await manager.initialize();

      await manager.shutdown();

      const count = await manager.getRunningCount();
      expect(count).toBe(0);
    });
  });
});
