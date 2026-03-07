/**
 * Subagent 集成测试（简化版本，避免复杂 mock）
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SubagentManager } from '../../src/core/subagent';
import type { SubagentManagerConfig } from '../../src/core/subagent/types';
import { MessageBus } from '../../src/bus/queue';
import { ToolRegistry } from '../../src/tools';

describe('Subagent Integration Tests', () => {
  let manager: SubagentManager;
  let bus: MessageBus;
  let provider: any;
  let tools: ToolRegistry;

  beforeAll(async () => {
    bus = new MessageBus();
    provider = {
      chat: vi.fn().mockResolvedValue({
        content: 'Test response from subagent',
        toolCalls: [],
      }),
    };
    tools = new ToolRegistry();

    const config: SubagentManagerConfig = {
      bus,
      provider: provider as any,
      tools,
      workspace: '/tmp/test-workspace',
      config: {
        agents: {
          defaults: {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 4096,
          },
        },
        subagent: {
          enabled: true,
          mode: 'embedded' as const,
          concurrency: 2,
          maxIterations: 5,
          timeout: 60,
          dataPath: '/tmp/test-bunqueue-integration.db',
        },
      } as any,
    };

    manager = new SubagentManager(config);
    await manager.initialize();
  });

  afterAll(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Task Lifecycle', () => {
    it('should spawn a task successfully', async () => {
      const taskDescription = 'Test task for integration';

      const spawnResult = await manager.spawn(taskDescription, {
        label: 'Integration Test Task',
        originChannel: 'test',
        originChatId: 'integration-test',
        sessionKey: 'test:integration-test',
      });

      expect(spawnResult).toContain('started');
      expect(spawnResult).toContain('id:');
    }, 10000);

    it('should return correct mode', async () => {
      const mode = manager.getMode();

      expect(mode).toBe('embedded');
    });
  });

  describe('Manager State', () => {
    it('should return running count', async () => {
      const count = await manager.getRunningCount();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should handle disabled subagent', async () => {
      const disabledConfig = {
        bus,
        provider: provider as any,
        tools,
        workspace: '/tmp/test-workspace',
        config: {
          agents: {
            defaults: {
              model: 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 4096,
            },
          },
          subagent: {
            enabled: false,
            mode: 'embedded' as const,
            concurrency: 1,
            maxIterations: 15,
            timeout: 300,
            dataPath: '/tmp/test-bunqueue-integration.db',
          },
        } as any,
      };

      const disabledManager = new SubagentManager(disabledConfig);
      await disabledManager.initialize();

      const result = await disabledManager.spawn('Test task');

      expect(result).toContain('disabled');
    });
  });
});
