/**
 * MCP Client - 连接和管理MCP服务器
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { MCPServerConfig, MCPToolDefinition, MCPToolResult } from './types';
import { logger } from '../utils/logger';

export class MCPClient {
  private client: Client;
  private serverConfig: MCPServerConfig;
  private tools: Map<string, MCPToolDefinition> = new Map();
  private connected = false;

  constructor(config: MCPServerConfig) {
    this.serverConfig = config;
    this.client = new Client({
      name: `nanobot-mcp-client-${config.name}`,
      version: '1.0.0',
    });
  }

  async connect(): Promise<void> {
    try {
      let transport: any;

      if (this.serverConfig.type === 'stdio' && this.serverConfig.stdio) {
        // STDIO 传输
        const params: Record<string, unknown> = {
          command: this.serverConfig.stdio.command,
          args: this.serverConfig.stdio.args,
        };

        if (this.serverConfig.stdio.env) {
          params.env = this.serverConfig.stdio.env;
        }

        if (this.serverConfig.stdio.cwd) {
          params.cwd = this.serverConfig.stdio.cwd;
        }

        transport = new StdioClientTransport(params as StdioServerParameters);
      } else if (this.serverConfig.type === 'http' && this.serverConfig.http) {
        // HTTP 传输
        const httpOptions: Record<string, unknown> = {};

        if (this.serverConfig.http.oauth) {
          // OAuth 配置
          httpOptions.authProvider = {
            clientId: this.serverConfig.http.oauth.clientId!,
            clientSecret: this.serverConfig.http.oauth.clientSecret!,
            authorizationEndpoint: this.serverConfig.http.oauth.authorizationEndpoint!,
            tokenEndpoint: this.serverConfig.http.oauth.tokenEndpoint!,
          };
        }

        transport = new StreamableHTTPClientTransport(
          new URL(this.serverConfig.http.url),
          httpOptions as any,
        );
      } else {
        throw new Error(`Invalid MCP server configuration for "${this.serverConfig.name}"`);
      }

      await this.client.connect(transport);
      this.connected = true;

      const toolsList = await this.client.listTools();

      for (const tool of toolsList.tools) {
        this.tools.set(tool.name, {
          name: tool.name,
          description: tool.description ?? '',
          inputSchema: tool.inputSchema as any,
        });
      }

      logger.info(
        `Connected to MCP server "${this.serverConfig.name}" (${this.serverConfig.type}) with ${this.tools.size} tools`,
      );
    } catch (error) {
      logger.error({ error }, `Failed to connect to MCP server "${this.serverConfig.name}"`);
      throw error;
    }
  }

  async callTool(name: string, args: any): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error(`MCP server "${this.serverConfig.name}" is not connected`);
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      return result as MCPToolResult;
    } catch (error) {
      logger.error(
        { error, tool: name, args },
        `Failed to call tool "${name}" on MCP server "${this.serverConfig.name}"`,
      );
      throw error;
    }
  }

  getToolDefinitions(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      logger.info(`Disconnected from MCP server "${this.serverConfig.name}"`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
