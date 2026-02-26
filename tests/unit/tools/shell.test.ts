/**
 * Shell 执行工具测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execa } from 'execa';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { ExecTool } from '../../../src/tools/shell';
import type { Config } from '../../../src/config/schema';

const mockedExeca = vi.mocked(execa);

describe('ExecTool', () => {
  let config: Config;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      agents: {
        defaults: {
          workspace: '~/.nanobot/workspace',
          model: 'openai:gpt-4o',
          temperature: 0.1,
          maxTokens: 8192,
          maxIterations: 40,
          memoryWindow: 100,
        },
      },
      providers: {
        openai: { apiKey: 'test-key', apiBase: 'https://api.openai.com/v1' },
        anthropic: { apiKey: 'test-key' },
        openrouter: { apiKey: 'test-key' },
        deepseek: { apiKey: 'test-key' },
      },
      channels: {
        whatsapp: { enabled: false, allowFrom: [], usePairingCode: false },
        feishu: {
          enabled: false,
          appId: '',
          appSecret: '',
          encryptKey: '',
          verificationToken: '',
          allowFrom: [],
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
          fromAddress: 'test@example.com',
          allowFrom: [],
          autoReplyEnabled: true,
        },
      },
      tools: {
        restrictToWorkspace: false,
        exec: { timeout: 60, allowedCommands: [] },
        web: { search: { apiKey: '' } },
      },
    };
  });

  describe('execute', () => {
    it('should execute command successfully', async () => {
      mockedExeca.mockResolvedValue({
        stdout: 'test',
        stderr: '',
        exitCode: 0,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as never);
      const tool = new ExecTool(config);
      const result = await tool.execute({ command: 'echo "test"' });
      expect(result).toBe('test');
    });

    it('should include stderr in result', async () => {
      mockedExeca.mockResolvedValue({
        stdout: '',
        stderr: 'error message',
        exitCode: 1,
        failed: false,
        timedOut: false,
        isCanceled: false,
        killed: false,
      } as never);
      const tool = new ExecTool(config);
      const result = await tool.execute({ command: 'command' });
      expect(result).toContain('error message');
      expect(result).toContain('[exit code: 1]');
    });

    it('should timeout after configured time', async () => {
      mockedExeca.mockRejectedValue(new Error('Command timed out'));
      const tool = new ExecTool({
        ...config,
        tools: { ...config.tools, exec: { timeout: 1, allowedCommands: [] } },
      });
      const result = await tool.execute({ command: 'sleep 5' });
      expect(result).toContain('Error: Command execution failed');
      expect(result).toContain('timed out');
    });

    it('should return error for disallowed command', async () => {
      const tool = new ExecTool({
        ...config,
        tools: { ...config.tools, exec: { timeout: 60, allowedCommands: ['ls', 'cat'] } },
      });
      const result = await tool.execute({ command: 'rm -rf /' });
      expect(result).toContain('Error: Command "rm" not in allowlist');
    });

    it('should include tool hint in errors', async () => {
      mockedExeca.mockRejectedValue(new Error('Command failed'));
      const tool = new ExecTool(config);
      const result = await tool.execute({ command: 'failing command' });
      expect(result).toContain('Error: Command execution failed');
    });
  });
});
