/**
 * MCP Manager - 管理多个MCP服务器连接
 */

import type { MCPServerConfig } from './types';
import { MCPClient } from './client';
import { logger } from '../utils/logger';

export class MCPManager {
  private clients: Map<string, MCPClient> = new Map();

  async connectServer(config: MCPServerConfig): Promise<void> {
    const { name } = config;

    if (this.clients.has(name)) {
      logger.warn(`MCP server "${name}" is already connected`);
      return;
    }

    try {
      const client = new MCPClient(config);
      await client.connect();
      this.clients.set(name, client);
    } catch (error) {
      logger.error({ error }, `Failed to initialize MCP server "${name}"`);
      throw error;
    }
  }

  async connectAll(servers: MCPServerConfig[]): Promise<void> {
    const connectPromises = servers.map(config =>
      this.connectServer(config).catch(error => {
        logger.error({ error }, `Skipping failed MCP server "${config.name}"`);
      }),
    );

    await Promise.all(connectPromises);
    logger.info(`Connected to ${this.clients.size} MCP server(s)`);
  }

  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  getAllToolDefinitions() {
    const allTools: Array<{ serverName: string; tool: any }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      const tools = client.getToolDefinitions();
      for (const tool of tools) {
        allTools.push({
          serverName,
          tool,
        });
      }
    }

    return allTools;
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);

    if (!client) {
      throw new Error(`MCP server "${serverName}" is not connected`);
    }

    return client.callTool(toolName, args);
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client =>
      client.disconnect().catch(error => {
        logger.error({ error }, 'Error disconnecting MCP server');
      }),
    );

    await Promise.all(disconnectPromises);
    this.clients.clear();
    logger.info('Disconnected from all MCP servers');
  }

  async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);

    if (!client) {
      logger.warn(`MCP server "${name}" is not connected`);
      return;
    }

    await client.disconnect();
    this.clients.delete(name);
    logger.info(`Disconnected from MCP server "${name}"`);
  }

  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  getServerCount(): number {
    return this.clients.size;
  }
}
