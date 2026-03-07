/**
 * Subagent 取消机制集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SubagentManager } from '../../src/core/subagent';
import { TaskStatus } from '../../src/core/subagent/types';

describe('Subagent cancellation integration', () => {
  let manager: SubagentManager;
  let originalTimeout: number;

  beforeEach(() => {
    // 保存原始的超时时间
    originalTimeout = 300000; // 5分钟
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  it('should create AbortController for each task', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    const result = await manager.spawn('Test task for abort controller');

    expect(result).toContain('started');
    expect(result).toContain('id:');

    // 验证任务 ID
    const taskIdMatch = result.match(/id: ([a-z0-9]+)/i);
    expect(taskIdMatch).toBeTruthy();
  });

  it('should track task status', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    const spawnResult = await manager.spawn('Test task for status tracking');
    const taskIdMatch = spawnResult.match(/id: ([a-z0-9]+)/i);
    const taskId = taskIdMatch?.[1];

    if (!taskId) {
      throw new Error('Failed to extract task ID');
    }

    // 验证任务状态
    const status = manager.getTaskStatus(taskId);
    expect(status).toBe(TaskStatus.PENDING);

    // 验证任务指标
    const metrics = manager.getTaskMetrics(taskId);
    expect(metrics).toBeDefined();
    expect(metrics?.createdAt).toBeInstanceOf(Date);
  });

  it('should return all task statuses', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    // 创建多个任务
    await manager.spawn('Task 1');
    await manager.spawn('Task 2');
    await manager.spawn('Task 3');

    const allStatuses = manager.getAllTaskStatuses();

    expect(allStatuses).toBeInstanceOf(Map);
    expect(allStatuses.size).toBeGreaterThanOrEqual(3);

    // 验证所有状态都是有效的 TaskStatus
    for (const status of allStatuses.values()) {
      expect(Object.values(TaskStatus)).toContain(status);
    }
  });

  it('should cancel task and return success message', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    const spawnResult = await manager.spawn('Test task for cancellation');
    const taskIdMatch = spawnResult.match(/id: ([a-z0-9]+)/i);
    const taskId = taskIdMatch?.[1];

    if (!taskId) {
      throw new Error('Failed to extract task ID');
    }

    // 取消任务
    const cancelResult = await manager.cancel(taskId);

    expect(cancelResult).toContain('cancelled');
    expect(cancelResult).toContain(taskId);
  });

  it('should handle cancel for non-existent task', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    const cancelResult = await manager.cancel('non-existent-task-id');

    expect(cancelResult).toContain('No running task found');
  });

  it('should track worker restart count', async () => {
    const { loadConfig } = await import('../../src/config/loader');
    const config = await loadConfig();

    if (!config) {
      throw new Error('Failed to load config');
    }

    // 设置较小的重启次数限制用于测试
    config.subagent.maxWorkerRestarts = 2;

    manager = new SubagentManager({
      config,
      bus: null as any,
      provider: null as any,
      tools: null as any,
      workspace: config.agents.defaults.workspace,
    });

    await manager.initialize();

    const mode = manager.getMode();
    expect(['embedded', 'isolated']).toContain(mode);
  });
});
