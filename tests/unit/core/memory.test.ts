/**
 * MemoryConsolidator 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MemoryConsolidator } from '../../../src/core/memory';
import type { Config } from '../../../src/config/schema';
import type { Session } from '../../../src/storage';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

describe('MemoryConsolidator', () => {
  let memory: MemoryConsolidator;
  let testWorkspace: string;

  const createTestConfig = (workspace: string): Config => ({
    agents: {
      defaults: {
        workspace,
        model: 'openai:gpt-4o',
        temperature: 0.1,
        maxTokens: 8192,
        maxIterations: 40,
        memoryWindow: 100,
      },
    },
    providers: {
      openai: { apiKey: 'test-key' },
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
  });

  const createSession = (overrides: Partial<Session> = {}): Session => ({
    key: 'test-session',
    messages: [],
    lastConsolidated: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
    ...overrides,
  });

  beforeEach(async () => {
    testWorkspace = path.join(os.tmpdir(), `nanobot-test-${Date.now()}`);
    await fs.mkdir(path.join(testWorkspace, 'memory'), { recursive: true });
    const config = createTestConfig(testWorkspace);
    memory = new MemoryConsolidator(config);
  });

  afterEach(async () => {
    try {
      await fs.rm(testWorkspace, { recursive: true, force: true });
    } catch {}
  });

  describe('needsConsolidation', () => {
    it('should return false when session has no messages', () => {
      const session = createSession({ messages: [], lastConsolidated: 0 });

      expect(memory.needsConsolidation(session)).toBe(false);
    });

    it('should return false when unconsolidated messages below threshold', () => {
      const session = createSession({
        messages: Array(30)
          .fill(null)
          .map((_, i) => ({ role: 'user', content: `msg${i}` })) as any,
        lastConsolidated: 20,
      });

      expect(memory.needsConsolidation(session)).toBe(false);
    });

    it('should return true when unconsolidated messages exceed threshold', () => {
      const session = createSession({
        messages: Array(60)
          .fill(null)
          .map((_, i) => ({ role: 'user', content: `msg${i}` })) as any,
        lastConsolidated: 0,
      });

      expect(memory.needsConsolidation(session)).toBe(true);
    });
  });

  describe('consolidate', () => {
    it('should create memory and history files when consolidating', async () => {
      const session = createSession({
        key: 'test-session',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ] as any,
        lastConsolidated: 0,
      });

      await memory.consolidate(session, true);

      const memoryPath = path.join(testWorkspace, 'memory', 'MEMORY.md');
      const historyPath = path.join(testWorkspace, 'memory', 'HISTORY.md');

      const memoryContent = await fs.readFile(memoryPath, 'utf-8');
      const historyContent = await fs.readFile(historyPath, 'utf-8');

      expect(memoryContent).toContain('会话摘要');
      expect(memoryContent).toContain('test-session');
      expect(historyContent).toContain('test-session');
      expect(historyContent).toContain('Hello');
    });

    it('should update lastConsolidated after consolidation', async () => {
      const session = createSession({
        messages: Array(60)
          .fill(null)
          .map((_, i) => ({ role: 'user', content: `msg${i}` })) as any,
        lastConsolidated: 0,
      });

      await memory.consolidate(session);

      expect(session.lastConsolidated).toBeGreaterThan(0);
    });

    it('should handle empty session gracefully', async () => {
      const session = createSession({
        key: 'empty-session',
        messages: [],
        lastConsolidated: 0,
      });

      await memory.consolidate(session, true);

      const memoryPath = path.join(testWorkspace, 'memory', 'MEMORY.md');
      const content = await fs.readFile(memoryPath, 'utf-8');

      expect(content).toContain('empty-session');
    });
  });

  describe('readLongTerm', () => {
    it('should return empty string when memory file does not exist', async () => {
      const result = await memory.readLongTerm();
      expect(result).toBe('');
    });

    it('should return memory content when file exists', async () => {
      const memoryPath = path.join(testWorkspace, 'memory', 'MEMORY.md');
      await fs.writeFile(memoryPath, '# Memory\n\nTest memory content', 'utf-8');

      const result = await memory.readLongTerm();
      expect(result).toContain('Test memory content');
    });
  });

  describe('getMemoryContext', () => {
    it('should return empty string when no memory exists', async () => {
      const result = await memory.getMemoryContext();
      expect(result).toBe('');
    });

    it('should return formatted memory context', async () => {
      const memoryPath = path.join(testWorkspace, 'memory', 'MEMORY.md');
      await fs.writeFile(memoryPath, '# Memory\n\nTest content', 'utf-8');

      const result = await memory.getMemoryContext();
      expect(result).toContain('Long-term Memory');
      expect(result).toContain('Test content');
    });
  });

  describe('search', () => {
    it('should return message when keyword found', async () => {
      const historyPath = path.join(testWorkspace, 'memory', 'HISTORY.md');
      const content = `## 2024-01-01 - test
**user**: Hello world

---
## 2024-01-02 - test2
**user**: Goodbye
`;
      await fs.writeFile(historyPath, content, 'utf-8');

      const result = await memory.search('Hello');
      expect(result).toContain('Hello world');
    });

    it('should return not found message when keyword not found', async () => {
      const historyPath = path.join(testWorkspace, 'memory', 'HISTORY.md');
      await fs.writeFile(historyPath, '## 2024-01-01 - test\n**user**: Hello\n', 'utf-8');

      const result = await memory.search('nonexistent');
      expect(result).toContain('未找到');
    });

    it('should return no history message when file does not exist', async () => {
      const result = await memory.search('test');
      expect(result).toContain('暂无历史记录');
    });
  });
});
