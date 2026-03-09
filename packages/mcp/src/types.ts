/**
 * MCP 类型定义
 */

export type { MCPServerConfig, MCPConfig, MCPServerTypeEnum } from '../config/schema';

export interface MCPToolDefinition {
  /** 工具名称 */
  name: string;

  /** 工具描述 */
  description: string;

  /** 输入参数 Schema */
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
        default?: any;
      }
    >;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

export interface MCPToolDefinition {
  /** 工具名称 */
  name: string;

  /** 工具描述 */
  description: string;

  /** 输入参数 Schema */
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
        default?: any;
      }
    >;
    required?: string[];
  };
}

export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
  }>;
}
