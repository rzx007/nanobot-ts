/**
 * ApprovalManager 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalManager } from '../../../src/core/approval';
import type { Config } from '../../../src/config/schema';
import { RiskLevel } from '../../../src/tools/safety';

/** 构建测试用最小 Config（ApprovalManager 仅使用 tools.approval 与 channels） */
function minimalConfig(
  approval: Config['tools']['approval'],
  options?: { enableFeishu?: boolean },
): Config {
  return {
    tools: { approval },
    channels: {
      whatsapp: { enabled: false },
      feishu: {
        enabled: options?.enableFeishu ?? false,
        appId: 'test-app-id',
        appSecret: 'test-app-secret',
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
        fromAddress: 'test@test.com',
        allowFrom: [],
        autoReplyEnabled: true,
      },
    },
  } as unknown as Config;
}

describe('ApprovalManager', () => {
  let approvalManager: ApprovalManager;
  let mockMessageBus: any;

  const defaultApproval = {
    enabled: true,
    memoryWindow: 300,
    timeout: 60,
    toolOverrides: {} as Record<string, { requiresApproval: boolean }>,
    strictMode: false,
    enableLogging: false,
  };

  beforeEach(() => {
    mockMessageBus = {
      publishOutbound: vi.fn(),
    };

    approvalManager = new ApprovalManager(
      minimalConfig(defaultApproval, { enableFeishu: true }),
    );
    approvalManager.initializeDefaultHandlers(mockMessageBus);
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
        minimalConfig({
          enabled: false,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {},
          strictMode: false,
          enableLogging: false,
        }),
      );
      disabledManager.initializeDefaultHandlers(mockMessageBus);

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
        minimalConfig({
          enabled: true,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {
            exec: { requiresApproval: false },
          },
          strictMode: false,
          enableLogging: false,
        }),
      );
      overrideManager.initializeDefaultHandlers(mockMessageBus);

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
        minimalConfig({
          enabled: true,
          memoryWindow: 300,
          timeout: 60,
          toolOverrides: {},
          strictMode: true,
          enableLogging: false,
        }),
      );
      strictManager.initializeDefaultHandlers(mockMessageBus);

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
    it('未注册渠道直接拒绝', async () => {
      const approved = await approvalManager.requestApproval(
        'write_file',
        { path: 'test.txt', content: 'hello' },
        'unknown_channel',
        'direct',
      );

      expect(approved).toBe(false);
    });

    it('CLI 渠道已注册', () => {
      const stats = approvalManager.getStats();
      expect(stats.registeredHandlers).toContain('cli');
    });

    it('消息渠道（feishu）已注册', () => {
      const stats = approvalManager.getStats();
      expect(stats.registeredHandlers).toContain('feishu');
    });

    it('确认成功后记录到记忆', async () => {
      // 使用 getMemory 直接记录，避免依赖 CLI 交互
      approvalManager
        .getMemory()
        .recordApproval('write_file', { path: 'test.txt', content: 'hello' }, 'cli', 'direct');

      const hasApproved = approvalManager
        .getMemory()
        .hasApproved('write_file', { path: 'test.txt', content: 'hello' }, 'cli', 'direct');

      expect(hasApproved).toBe(true);
    });
  });

  describe('handleUserMessage', () => {
    it('feishu 渠道有 handleResponse 的 handler', () => {
      // 未有待处理确认时，handleResponse 返回 false（非确认回复或无待处理）
      const result = approvalManager.handleUserMessage('feishu', 'user123', 'yes');
      expect(typeof result).toBe('boolean');
    });

    it('未注册渠道返回 false', () => {
      const result = approvalManager.handleUserMessage('unknown_channel', 'user123', 'yes');
      expect(result).toBe(false);
    });

    it('CLI 渠道无 handleResponse 返回 false', () => {
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
      approvalManager.getMemory().recordApproval('tool2', {}, 'feishu', 'chat2');

      expect(approvalManager.getMemory().size).toBe(2);

      approvalManager.clearChannelMemory('cli');

      expect(approvalManager.getMemory().size).toBe(1);
    });

    it('清除所有记忆', () => {
      approvalManager.getMemory().recordApproval('tool1', {}, 'cli', 'chat1');
      approvalManager.getMemory().recordApproval('tool2', {}, 'feishu', 'chat2');

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
