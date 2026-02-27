/**
 * ApprovalMemory 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApprovalMemory } from '../../../src/core/approval-handlers/memory';
import type { ApprovalConfig } from '../../../src/config/approval-schema';

describe('ApprovalMemory', () => {
  let memory: ApprovalMemory;

  beforeEach(() => {
    memory = new ApprovalMemory({
      enabled: true,
      memoryWindow: 300,
      timeout: 60,
      toolOverrides: {},
      strictMode: false,
      enableLogging: false,
    });
  });

  afterEach(() => {
    memory.clearAll();
  });

  describe('recordApproval', () => {
    it('记录新的确认', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      expect(memory.size).toBe(1);
    });

    it('记录多个确认', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');
      memory.recordApproval('exec', { command: 'ls' }, 'cli', 'chat1');
      memory.recordApproval('delete_file', { path: 'test.txt' }, 'message', 'chat2');

      expect(memory.size).toBe(3);
    });

    it('相同确认覆盖旧记录', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');
      expect(memory.size).toBe(1);

      // 再次记录
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');
      expect(memory.size).toBe(1);
    });
  });

  describe('hasApproved', () => {
    it('未记录的确认返回 false', () => {
      const result = memory.hasApproved('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      expect(result).toBe(false);
    });

    it('已记录的确认返回 true', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      const result = memory.hasApproved('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      expect(result).toBe(true);
    });

    it('不同聊天ID返回 false', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      const result = memory.hasApproved('write_file', { path: 'test.txt' }, 'cli', 'chat2');

      expect(result).toBe(false);
    });

    it('不同渠道返回 false', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      const result = memory.hasApproved('write_file', { path: 'test.txt' }, 'message', 'chat1');

      expect(result).toBe(false);
    });

    it('不同参数返回 false', () => {
      memory.recordApproval('write_file', { path: 'test.txt', content: 'hello' }, 'cli', 'chat1');

      const result = memory.hasApproved(
        'write_file',
        { path: 'test.txt', content: 'world' },
        'cli',
        'chat1',
      );

      expect(result).toBe(false);
    });

    it('过期记录自动删除', () => {
      memory.recordApproval('write_file', { path: 'test.txt' }, 'cli', 'chat1');

      expect(memory.hasApproved('write_file', { path: 'test.txt' }, 'cli', 'chat1')).toBe(true);

      // 模拟过期
      const record = memory['records'].values().next().value;
      record.timestamp = Date.now() - 400000; // 400秒前，超过300秒窗口

      expect(memory.hasApproved('write_file', { path: 'test.txt' }, 'cli', 'chat1')).toBe(false);
      expect(memory.size).toBe(0);
    });
  });

  describe('clearChat', () => {
    it('清除指定聊天的所有记录', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat1');
      memory.recordApproval('tool3', {}, 'message', 'chat2');

      expect(memory.size).toBe(3);

      memory.clearChat('chat1');

      expect(memory.size).toBe(1);
    });

    it('清除不存在的聊天不影响其他记录', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');

      memory.clearChat('chat999');

      expect(memory.size).toBe(1);
    });
  });

  describe('clearChannel', () => {
    it('清除指定渠道的所有记录', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat2');
      memory.recordApproval('tool3', {}, 'message', 'chat1');

      expect(memory.size).toBe(3);

      memory.clearChannel('cli');

      expect(memory.size).toBe(1);
    });
  });

  describe('clearExpired', () => {
    it('清除所有过期记录', () => {
      const now = Date.now();

      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat2');
      memory.recordApproval('tool3', {}, 'message', 'chat1');

      const records = memory['records'];
      const entries = Array.from(records.entries());

      entries[0][1].timestamp = now - 400000;
      entries[1][1].timestamp = now - 500000;
      entries[2][1].timestamp = now - 10000;

      const cleared = memory.clearExpired();

      expect(cleared).toBe(2);
      expect(memory.size).toBe(1);
    });

    it('没有过期记录返回 0', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');

      const cleared = memory.clearExpired();

      expect(cleared).toBe(0);
      expect(memory.size).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('清除所有记录', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat2');
      memory.recordApproval('tool3', {}, 'message', 'chat1');

      expect(memory.size).toBe(3);

      memory.clearAll();

      expect(memory.size).toBe(0);
    });

    it('清除空记录无错误', () => {
      expect(() => memory.clearAll()).not.toThrow();
      expect(memory.size).toBe(0);
    });
  });

  describe('统计信息', () => {
    it('获取记录数量', () => {
      expect(memory.size).toBe(0);

      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      expect(memory.size).toBe(1);

      memory.recordApproval('tool2', {}, 'cli', 'chat2');
      expect(memory.size).toBe(2);
    });

    it('获取指定聊天的记录数量', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat1');
      memory.recordApproval('tool3', {}, 'message', 'chat2');

      expect(memory.getChatRecordCount('chat1')).toBe(2);
      expect(memory.getChatRecordCount('chat2')).toBe(1);
      expect(memory.getChatRecordCount('chat999')).toBe(0);
    });

    it('获取指定渠道的记录数量', () => {
      memory.recordApproval('tool1', {}, 'cli', 'chat1');
      memory.recordApproval('tool2', {}, 'cli', 'chat2');
      memory.recordApproval('tool3', {}, 'message', 'chat1');

      expect(memory.getChannelRecordCount('cli')).toBe(2);
      expect(memory.getChannelRecordCount('message')).toBe(1);
      expect(memory.getChannelRecordCount('whatsapp')).toBe(0);
    });
  });
});
