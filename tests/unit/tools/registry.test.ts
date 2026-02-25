/**
 * 工具注册表测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry';
import { Tool } from '../../../src/tools/base';

// 模拟工具类
class MockTool extends Tool {
  name = 'mock_tool';
  description = '模拟工具';
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

  async execute(params: { input: string }): Promise<string> {
    return `已处理: ${params.input}`;
  }
}

// 第二个模拟工具类
class MockTool2 extends Tool {
  name = 'mock_tool_2';
  description = '模拟工具 2';
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

  async execute(params: { input: string }): Promise<string> {
    return `已处理 2: ${params.input}`;
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.has('mock_tool')).toBe(true);
      expect(registry.get('mock_tool')).toBe(tool);
    });

    it('should overwrite existing tool', () => {
      const tool1 = new MockTool();
      const tool2 = new MockTool();
      
      registry.register(tool1);
      registry.register(tool2);

      expect(registry.size).toBe(1);
      expect(registry.get('mock_tool')).toBe(tool2);
    });
  });

  describe('unregister', () => {
    it('should unregister a tool', () => {
      const tool = new MockTool();
      registry.register(tool);
      registry.unregister('mock_tool');

      expect(registry.has('mock_tool')).toBe(false);
      expect(registry.get('mock_tool')).toBeUndefined();
    });

    it('should return true for existing tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      const result = registry.unregister('mock_tool');
      expect(result).toBe(true);
    });

    it('should return false for non-existing tool', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return registered tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.get('mock_tool')).toBe(tool);
    });

    it('should return undefined for non-existent tool', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing tool', () => {
      const tool = new MockTool();
      registry.register(tool);

      expect(registry.has('mock_tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('getToolNames', () => {
    it('should return all tool names', () => {
      const tool1 = new MockTool();
      const tool2 = new MockTool2();

      registry.register(tool1);
      registry.register(tool2);

      const names = registry.getToolNames();
      expect(names).toContain('mock_tool');
      expect(names).toContain('mock_tool_2');
      expect(names).toHaveLength(2);
    });
  });

  describe('getDefinitions', () => {
    it('should return all tool definitions as AI SDK ToolSet', () => {
      const t = new MockTool();
      registry.register(t);

      const definitions = registry.getDefinitions();

      expect(Object.keys(definitions)).toHaveLength(1);
      expect(definitions).toHaveProperty('mock_tool');
      expect(definitions['mock_tool']).toMatchObject({
        description: '模拟工具',
      });
      expect(definitions['mock_tool']).toHaveProperty('description', '模拟工具');
    });
  });

  describe('execute', () => {
    it('should execute tool and return result', async () => {
      const tool = new MockTool();
      registry.register(tool);

      const result = await registry.execute('mock_tool', { input: 'test' });

      expect(result).toBe('已处理: test');
    });

    it('should return error for non-existent tool', async () => {
      const result = await registry.execute('nonexistent', {});

      expect(result).toContain('错误: 工具 "nonexistent" 不存在');
    });

    it('should return error for invalid params', async () => {
      const tool = new MockTool();
      registry.register(tool);

      const result = await registry.execute('mock_tool', {}); // 缺少必需参数

      expect(result).toContain('错误: 工具 "mock_tool" 的参数无效');
    });

    it('should include error hint in tool errors', async () => {
      const tool = new MockTool();
      registry.register(tool);

      // 修改 mock 返回 error
      tool.execute = async () => 'Error: 模拟错误';

      const result = await registry.execute('mock_tool', { input: 'test' });

      expect(result).toContain('[请分析上面的错误并尝试不同的方法。]');
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      const tool1 = new MockTool();
      const tool2 = new MockTool2();

      registry.register(tool1);
      registry.register(tool2);

      expect(registry.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all tools', () => {
      const tool1 = new MockTool();
      registry.register(tool1);

      expect(registry.size).toBe(1);

      registry.clear();

      expect(registry.size).toBe(0);
    });
  });
});
