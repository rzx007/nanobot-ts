/**
 * MessageApprovalHandler 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageApprovalHandler } from '../../../src/core/approval-handlers/message';

describe('MessageApprovalHandler', () => {
  let handler: MessageApprovalHandler;
  let mockBus: any;

  beforeEach(() => {
    mockBus = {
      publishOutbound: vi.fn().mockResolvedValue(undefined),
    };

    handler = new MessageApprovalHandler(mockBus);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('requestConfirmation', () => {
    it('发送确认消息到消息总线', async () => {
      const approvalPromise = handler.requestConfirmation({
        toolName: 'delete_file',
        params: { path: 'test.txt' },
        channel: 'message',
        chatId: 'user123',
        timeout: 10,
      });

      expect(mockBus.publishOutbound).toHaveBeenCalledWith({
        channel: 'message',
        chatId: 'user123',
        content: expect.stringContaining('⚠️ 工具执行需要确认'),
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('确认消息包含工具信息', async () => {
      await handler.requestConfirmation({
        toolName: 'write_file',
        params: { path: 'test.txt', content: 'hello' },
        channel: 'message',
        chatId: 'user123',
        timeout: 10,
      });

      const call = mockBus.publishOutbound.mock.calls[0][0];
      const content = call.content;

      expect(content).toContain('write_file');
      expect(content).toContain('test.txt');
      expect(content).toContain('hello');
      expect(content).toContain('10秒');
    });

    it('超时后返回 false', async () => {
      vi.useFakeTimers();

      const approvedPromise = handler.requestConfirmation({
        toolName: 'delete_file',
        params: { path: 'test.txt' },
        channel: 'message',
        chatId: 'user123',
        timeout: 1,
      });

      vi.advanceTimersByTime(2000);

      const approved = await approvedPromise;
      expect(approved).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('handleResponse', () => {
    it('yes 回复解析为 true', () => {
      const mockResolver = vi.fn() as any;
      const mockTimeoutId = setTimeout(() => {}, 10000) as any;

      handler['pendingApprovals'].set('test-id', {
        req: {
          toolName: 'delete_file',
          params: { path: 'test.txt' },
          channel: 'message',
          chatId: 'user123',
          timeout: 60,
        },
        resolver: mockResolver,
        timeoutId: mockTimeoutId,
        createdAt: Date.now(),
        approvalId: 'test-id',
      } as any);

      handler['approvalsByChatId'].set('user123', 'test-id');

      const result = handler.handleResponse('message', 'user123', 'yes');

      expect(result).toBe(true);
    });

    it('普通消息返回 false', () => {
      const mockResolver = vi.fn() as any;
      const mockTimeoutId = setTimeout(() => {}, 10000) as any;

      handler['pendingApprovals'].set('test-id', {
        req: {
          toolName: 'delete_file',
          params: { path: 'test.txt' },
          channel: 'message',
          chatId: 'user123',
          timeout: 60,
        },
        resolver: mockResolver,
        timeoutId: mockTimeoutId,
        createdAt: Date.now(),
        approvalId: 'test-id',
      } as any);

      handler['approvalsByChatId'].set('user123', 'test-id');

      const result = handler.handleResponse('message', 'user123', '帮我查一下天气');

      expect(result).toBe(false);
      expect(mockResolver.resolve).not.toHaveBeenCalled();
    });

    it('确认后清理超时计时器', () => {
      const mockResolver = vi.fn() as any;
      const mockTimeoutId = setTimeout(() => {}, 10000) as any;
      vi.spyOn(global, 'clearTimeout');

      handler['pendingApprovals'].set('test-id', {
        req: {
          toolName: 'delete_file',
          params: { path: 'test.txt' },
          channel: 'message',
          chatId: 'user123',
          timeout: 60,
        },
        resolver: mockResolver,
        timeoutId: mockTimeoutId,
        createdAt: Date.now(),
        approvalId: 'test-id',
      } as any);

      handler['approvalsByChatId'].set('user123', 'test-id');

      handler.handleResponse('message', 'user123', 'yes');

      expect(global.clearTimeout).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelPending', () => {
    it('取消待处理的确认', () => {
      const mockResolver = vi.fn() as any;
      const mockTimeoutId = setTimeout(() => {}, 10000) as any;
      vi.spyOn(global, 'clearTimeout');

      handler['pendingApprovals'].set('test-id', {
        req: {
          toolName: 'delete_file',
          params: { path: 'test.txt' },
          channel: 'message',
          chatId: 'user123',
          timeout: 60,
        },
        resolver: mockResolver,
        timeoutId: mockTimeoutId,
        createdAt: Date.now(),
        approvalId: 'test-id',
      } as any);

      handler['approvalsByChatId'].set('user123', 'test-id');

      handler.cancelPending('message', 'user123');

      expect(global.clearTimeout).toHaveBeenCalledTimes(1);
      expect(handler['pendingApprovals'].size).toBe(0);
      expect(handler['approvalsByChatId'].size).toBe(0);
    });

    it('取消不存在的确认无错误', () => {
      expect(() => handler.cancelPending('message', 'user999')).not.toThrow();
    });
  });
});
