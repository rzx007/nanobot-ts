/**
 * MCP 工具包装器 - 将MCP工具转换为nanobot工具
 */

import { MCPManager } from './manager';
import { Tool } from '../tools/base';
import type { MCPToolDefinition } from './types';
import { logger } from '../utils/logger';

export class MCPTool extends Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;

  constructor(
    private serverName: string,
    private manager: MCPManager,
    toolDef: MCPToolDefinition,
  ) {
    super();
    this.name = `${serverName}:${toolDef.name}`;
    this.description = `[MCP:${serverName}] ${toolDef.description}`;
    this.parameters = toolDef.inputSchema;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    try {
      const result = await this.manager.callTool(
        this.serverName,
        this.name.replace(`${this.serverName}:`, ''),
        params,
      );

      let output = '';
      for (const content of result.content) {
        if (content.type === 'text' && content.text) {
          output += content.text + '\n';
        }
      }

      return output.trim() || 'No output from tool';
    } catch (error) {
      logger.error(
        { error, serverName: this.serverName, toolName: this.name },
        'Error executing MCP tool',
      );
      return `Error executing MCP tool "${this.name}": ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

export class MCPToolWrapper {
  constructor(private manager: MCPManager) {}

  wrapMCPTools(): Tool[] {
    const wrappedTools: Tool[] = [];
    const allTools = this.manager.getAllToolDefinitions();

    for (const { serverName, tool } of allTools) {
      const wrapped = new MCPTool(serverName, this.manager, tool);
      wrappedTools.push(wrapped);
    }

    return wrappedTools;
  }
}
