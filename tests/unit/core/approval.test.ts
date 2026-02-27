/**
 * ApprovalManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalManager } from '../../../src/core/approval';
import type { ApprovalConfig } from '../../../src/config/approval-schema';
import { RiskLevel } from '../../../src/tools/safety';

describe('ApprovalManager', () => {
  let approvalManager: ApprovalManager;
  let mockMessageBus: any;
  let mockCLIHandler: any;
  let mockMessageHandler: any;

  beforeEach(() => {
    mockMessageBus = {
      publishOutbound: vi.fn(),
    };

    mockCLIHandler = {
      requestConfirmation: vi.fn(),
    };

    mockMessageHandler = {
      handleResponse: vi.fn(),
    };

    approvalManager = new ApprovalManager(
      {
        enabled: true,
        memoryWindow: 300,
        timeout: 60,
        toolOverrides: {},
        strictMode: false,
        enableLogging: false,
      },
      mockMessageBus,
    );

    approvalManager['handlers'].set('cli', mockCLIHandler);
    approvalManager['handlers'].set('message', mockMessageHandler);
    approvalManager['messageHandler'] = mockMessageHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('needsApproval', () => {
    it('LOW 风险工具不需要确认', async () => {
      const needsApproval = await approvalManager.needsApproval(
        'read_file',
        { path: 'test.txt' },
        RiskLevel.LOW,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(false);
    });

    it('HIGH 风险工具总是需要确认', async () => {
      const needsApproval = await approvalManager.needsApproval(
        'exec',
        { command: 'ls' },
        RiskLevel.HIGH,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(true);
    });

    it('MEDIUM 风险工具首次需要确认', async () => {
      const needsApproval = await approvalManager.needsApproval(
        'write_file',
        { path: 'test.txt', content: 'hello' },
        RiskLevel.MEDIUM,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(true);
    });

    it('MEDIUM 风险工具已记忆则不需要确认', async () => {
      approvalManager
        .getMemory()
        .recordApproval('write_file', { path: 'test.txt' }, 'cli', 'direct');

      const needsApproval = await approvalManager.needsApproval(
        'write_file',
        { path: 'test.txt' },
        RiskLevel.MEDIUM,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(false);
    });

    it('配置禁用时不需要确认', async () => {
      const disabledManager = new ApprovalManager(
        {
          enabled: false,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {},
          strictMode: false,
          enableLogging: false,
        },
        mockMessageBus,
      );

      const needsApproval = await disabledManager.needsApproval(
        'exec',
        { command: 'ls' },
        RiskLevel.HIGH,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(false);
    });

    it('配置覆盖默认策略', async () => {
      const overrideManager = new ApprovalManager(
        {
          enabled: true,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {
            exec: { requiresApproval: false },
          },
          strictMode: false,
          enableLogging: false,
        },
        mockMessageBus,
      );

      const needsApproval = await overrideManager.needsApproval(
        'exec',
        { command: 'ls' },
        RiskLevel.HIGH,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(false);
    });

    it('严格模式下 MEDIUM 风险也需要确认', async () => {
      const strictManager = new ApprovalManager(
        {
          enabled: true,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {},
          strictMode: true,
          enableLogging: false,
        },
        mockMessageBus,
      );

      strictManager.getMemory().recordApproval('write_file', { path: 'test.txt' }, 'cli', 'direct');

      const needsApproval = await strictManager.needsApproval(
        'write_file',
        { path: 'test.txt' },
        RiskLevel.MEDIUM,
        'cli',
        'direct',
      );

      expect(needsApproval).toBe(true);
    });
  });

  describe('requestApproval', () => {
    it('CLI 渠道成功确认', async () => {
      mockCLIHandler.requestConfirmation.mockResolvedValue(true);

      const approved = await approvalManager.requestApproval(
        'write_file',
        { path: 'test.txt', content: 'hello' },
        'cli',
        'direct',
      );

      expect(approved).toBe(true);
      expect(mockCLIHandler.requestConfirmation).toHaveBeenCalledWith({
        toolName: 'write_file',
        params: { path: 'test.txt', content: 'hello' },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });
    });

    it('CLI 渠道拒绝确认', async () => {
      mockCLIHandler.requestConfirmation.mockResolvedValue(false);

      const approved = await approvalManager.requestApproval(
        'delete_file',
        { path: 'test.txt' },
        'cli',
        'direct',
      );

      expect(approved).toBe(false);
    });

    it('消息渠道成功确认', async () => {
      mockMessageHandler.handleResponse.mockReturnValue(true);

      const approved = await approvalManager.requestApproval(
        'cron',
        { action: 'add', message: 'test' },
        'message',
        'user123',
      );

      expect(approved).toBe(true);
    });

    it('确认成功后记录到记忆', async () => {
      mockCLIHandler.requestConfirmation.mockResolvedValue(true);

      await approvalManager.requestApproval(
        'write_file',
        { path: 'test.txt', content: 'hello' },
        'cli',
        'direct',
      );

      const hasApproved = approvalManager
        .getMemory()
        .hasApproved('write_file', { path: 'test.txt', content: 'hello' }, 'cli', 'direct');

      expect(hasApproved).toBe(true);
    });
  });

  describe('handleUserMessage', () => {
    it('肯定回复返回 true', () => {
      mockMessageHandler.handleResponse.mockReturnValue(true);

      const result = approvalManager.handleUserMessage('message', 'user123', 'yes');

      expect(result).toBe(true);
      expect(mockMessageHandler.handleResponse).toHaveBeenCalledWith('message', 'user123', 'yes');
    });

    it('否定回复返回 true', () => {
      mockMessageHandler.handleResponse.mockReturnValue(true);

      const result = approvalManager.handleUserMessage('message', 'user123', 'no');

      expect(result).toBe(true);
    });

    it('普通消息返回 false', () => {
      mockMessageHandler.handleResponse.mockReturnValue(false);

      const result = approvalManager.handleUserMessage('message', 'user123', '帮我查一下天气');

      expect(result).toBe(false);
    });

    it('CLI 渠道没有消息处理器返回 false', () => {
      approvalManager['messageHandler'] = undefined;

      const result = approvalManager.handleUserMessage('cli', 'direct', 'yes');

      expect(result).toBe(false);
    });
  });

  describe('记忆管理', () => {
    it('清除指定聊天的记忆', () => {
      approvalManager.getMemory().recordApproval('tool1', {}, 'cli', 'chat1');
      approvalManager.getMemory().recordApproval('tool2', {}, 'cli', 'chat2');

      expect(approvalManager.getMemory().size).toBe(2);

      approvalManager.clearChatMemory('chat1');

      expect(approvalManager.getMemory().size).toBe(1);
    });

    it('清除指定渠道的记忆', () => {
      approvalManager.getMemory().recordApproval('tool1', {}, 'cli', 'chat1');
      approvalManager.getMemory().recordApproval('tool2', {}, 'message', 'chat2');

      expect(approvalManager.getMemory().size).toBe(2);

      approvalManager.clearChannelMemory('cli');

      expect(approvalManager.getMemory().size).toBe(1);
    });

    it('清除所有记忆', () => {
      approvalManager.getMemory().recordApproval('tool1', {}, 'cli', 'chat1');
      approvalManager.getMemory().recordApproval('tool2', {}, 'message', 'chat2');

      expect(approvalManager.getMemory().size).toBe(2);

      approvalManager.clearAllMemory();

      expect(approvalManager.getMemory().size).toBe(0);
    });
  });

  describe('配置管理', () => {
    it('获取统计信息', () => {
      approvalManager.getMemory().recordApproval('tool1', {}, 'cli', 'chat1');

      const stats = approvalManager.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.memorySize).toBe(1);
      expect(stats.registeredHandlers).toContain('cli');
      expect(stats.strictMode).toBe(false);
      expect(stats.memoryWindow).toBe(300);
    });

    it('更新配置', () => {
      approvalManager.updateConfig({
        timeout: 120,
        strictMode: true,
      });

      const config = approvalManager.getConfig();

      expect(config.timeout).toBe(120);
      expect(config.strictMode).toBe(true);
    });
  });
});
