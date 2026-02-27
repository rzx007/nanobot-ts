/**
 * CLIApprovalHandler 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLIApprovalHandler } from '../../../src/core/approval-handlers/cli';

describe('CLIApprovalHandler', () => {
  let handler: CLIApprovalHandler;
  let mockInquirer: any;

  beforeEach(() => {
    mockInquirer = {
      prompt: vi.fn(),
    };

    vi.doMock('inquirer', () => mockInquirer);
    handler = new CLIApprovalHandler();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unmock('inquirer');
  });

  describe('requestConfirmation', () => {
    it('用户确认返回 true', async () => {
      mockInquirer.prompt.mockResolvedValue({ approved: true });

      const approved = await handler.requestConfirmation({
        toolName: 'delete_file',
        params: { path: 'test.txt' },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      expect(approved).toBe(true);
      expect(mockInquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'approved',
          message: expect.stringContaining('⚠️  工具执行需要确认'),
          default: false,
        },
      ]);
    });

    it('用户拒绝返回 false', async () => {
      mockInquirer.prompt.mockResolvedValue({ approved: false });

      const approved = await handler.requestConfirmation({
        toolName: 'delete_file',
        params: { path: 'test.txt' },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      expect(approved).toBe(false);
    });

    it('显示正确的确认消息', async () => {
      mockInquirer.prompt.mockResolvedValue({ approved: true });

      await handler.requestConfirmation({
        toolName: 'write_file',
        params: { path: 'test.txt', content: 'hello' },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      const message = mockInquirer.prompt.mock.calls[0][0][0].message;

      expect(message).toContain('write_file');
      expect(message).toContain('test.txt');
      expect(message).toContain('hello');
    });

    it('参数过长时被截断', async () => {
      mockInquirer.prompt.mockResolvedValue({ approved: true });

      await handler.requestConfirmation({
        toolName: 'write_file',
        params: {
          path: 'test.txt',
          content: 'a'.repeat(100),
        },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      const message = mockInquirer.prompt.mock.calls[0][0].message;

      expect(message).toContain('...');
      expect(message).not.toContain('a'.repeat(100));
    });

    it('inquirer 错误时返回 false', async () => {
      mockInquirer.prompt.mockRejectedValue(new Error('User interrupted'));

      const approved = await handler.requestConfirmation({
        toolName: 'delete_file',
        params: { path: 'test.txt' },
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      expect(approved).toBe(false);
    });

    it('无参数时显示 "(无参数)"', async () => {
      mockInquirer.prompt.mockResolvedValue({ approved: true });

      await handler.requestConfirmation({
        toolName: 'read_file',
        params: {},
        channel: 'cli',
        chatId: 'direct',
        timeout: 60,
      });

      const message = mockInquirer.prompt.mock.calls[0][0].message;

      expect(message).toContain('(无参数)');
    });
  });
});
