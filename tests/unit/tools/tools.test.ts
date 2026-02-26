/**
 * 工具测试
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { Tool } from '../../../src/tools/base';
import {
  ReadFileTool,
  WriteFileTool,
  EditFileTool,
  ListDirTool,
  ExecTool,
  WebSearchTool,
  WebFetchTool,
  MessageTool,
} from '../../../src/tools';
import type { Config } from '../../../src/config/schema';
import { MessageBus } from '../../../src/bus/queue';

describe('Tools', () => {
  let config: Config;
  let bus: MessageBus;
  let tempDir: string;

  beforeEach(() => {
    bus = new MessageBus();
    config = {
      agents: {
        defaults: {
          workspace: '~/.nanobot/test-workspace',
          model: 'openai:gpt-4o',
          temperature: 0.1,
          maxTokens: 8192,
          maxIterations: 40,
          memoryWindow: 100,
        },
      },
      providers: {
        openai: {
          apiKey: 'test-key',
          apiBase: 'https://api.openai.com/v1',
        },
        anthropic: {
          apiKey: 'test-key',
        },
        openrouter: {
          apiKey: 'test-key',
        },
        deepseek: {
          apiKey: 'test-key',
        },
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

    tempDir = `test-temp-${Date.now()}`;
  });

  afterEach(async () => {
    // 清理临时文件
    try {
      const fs = await import('fs/promises');
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  describe('Tool base class', () => {
    it('should validate params correctly', () => {
      class ValidTool extends Tool {
        name = 'valid_tool';
        description = '测试工具';
        parameters = {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: '输入',
            },
          },
          required: ['input'],
        };

        async execute(params: Record<string, unknown>): Promise<string> {
          return 'success';
        }
      }

      const tool = new ValidTool();

      const errors = tool.validateParams({ input: 'test' });
      expect(errors).toHaveLength(0);

      const errors2 = tool.validateParams({});
      expect(errors2).toContain('缺少必需参数: input');
    });

    it('should convert to OpenAI schema', () => {
      class TestTool extends Tool {
        name = 'test_tool';
        description = '测试工具';
        parameters = {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: '输入',
            },
          },
          required: ['input'],
        };

        async execute(params: Record<string, unknown>): Promise<string> {
          return 'success';
        }
      }

      const tool = new TestTool();
      const schema = tool.toSchema();

      expect(schema).toMatchObject({
        description: '测试工具',
        inputSchema: {
          jsonSchema: tool.parameters,
        },
      });
    });
  });

  describe('File tools', () => {
    describe('ReadFileTool', () => {
      it('should have correct name and description', () => {
        const tool = new ReadFileTool(config);

        expect(tool.name).toBe('read_file');
        expect(tool.description).toBe('读取文件内容');
      });

      it('should require path parameter', () => {
        const tool = new ReadFileTool(config);

        expect(tool.parameters.required).toContain('path');
      });
    });

    describe('WriteFileTool', () => {
      it('should have correct name and description', () => {
        const tool = new WriteFileTool(config);

        expect(tool.name).toBe('write_file');
        expect(tool.description).toBe('写入内容到文件');
      });

      it('should require path and content parameters', () => {
        const tool = new WriteFileTool(config);

        expect(tool.parameters.required).toContain('path');
        expect(tool.parameters.required).toContain('content');
      });
    });

    describe('EditFileTool', () => {
      it('should have correct name and description', () => {
        const tool = new EditFileTool(config);

        expect(tool.name).toBe('edit_file');
        expect(tool.description).toBe('编辑文件中指定的字符串');
      });

      it('should require all three parameters', () => {
        const tool = new EditFileTool(config);

        expect(tool.parameters.required).toContain('path');
        expect(tool.parameters.required).toContain('oldStr');
        expect(tool.parameters.required).toContain('newStr');
      });
    });

    describe('ListDirTool', () => {
      it('should have correct name and description', () => {
        const tool = new ListDirTool(config);

        expect(tool.name).toBe('list_dir');
        expect(tool.description).toBe('列出目录内容');
      });

      it('should require path parameter', () => {
        const tool = new ListDirTool(config);

        expect(tool.parameters.required).toContain('path');
      });
    });
  });

  describe('ExecTool', () => {
    it('should have correct name and description', () => {
      const tool = new ExecTool(config);

      expect(tool.name).toBe('exec');
      expect(tool.description).toBe('执行 Shell 命令');
    });

    it('should require command parameter', () => {
      const tool = new ExecTool(config);

      expect(tool.parameters.required).toContain('command');
    });
  });

  describe('WebSearchTool', () => {
    it('should have correct name and description', () => {
      const tool = new WebSearchTool(config);

      expect(tool.name).toBe('web_search');
      expect(tool.description).toBe('使用 Brave Search 搜索网络');
    });

    it('should require query parameter', () => {
      const tool = new WebSearchTool(config);

      expect(tool.parameters.required).toContain('query');
    });
  });

  describe('WebFetchTool', () => {
    it('should have correct name and description', () => {
      const tool = new WebFetchTool(config);

      expect(tool.name).toBe('web_fetch');
      expect(tool.description).toBe('获取网页内容');
    });

    it('should require url parameter', () => {
      const tool = new WebFetchTool(config);

      expect(tool.parameters.required).toContain('url');
    });
  });

  describe('MessageTool', () => {
    it('should have correct name and description', () => {
      const tool = new MessageTool(config, bus);

      expect(tool.name).toBe('message');
      expect(tool.description).toBe('发送消息到指定的聊天渠道');
    });

    it('should require channel and chatId parameters', () => {
      const tool = new MessageTool(config, bus);

      expect(tool.parameters.required).toContain('channel');
      expect(tool.parameters.required).toContain('chatId');
      expect(tool.parameters.required).toContain('content');
    });
  });
});
