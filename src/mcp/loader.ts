/**
 * MCP Loader - 统一的MCP工具加载和管理
 */

import path from 'path';
import fs from 'fs/promises';
import { ToolRegistry } from '../tools';
import { MCPManager } from './manager';
import { MCPToolWrapper } from './wrapper';
import type { MCPConfig } from '../config/schema';
import { MCPConfigSchema } from '../config/schema';
import { logger } from '../utils/logger';
import { Config } from '../config/schema';

/**
 * 获取 MCP 配置路径
 */
export function getMCPConfigPath(workspace: string): string {
  return path.join(workspace, 'mcp.json');
}

/**
 * 加载 MCP 配置
 */
export async function loadMCPConfig(workspace: string): Promise<MCPConfig | null> {
  const mcpConfigPath = getMCPConfigPath(workspace);

  try {
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = MCPConfigSchema.parse(parsed);
    return result;
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') {
      logger.debug(`MCP config not found at ${mcpConfigPath}`);
      return null;
    }
    logger.error({ error }, 'Failed to load MCP config');
    return null;
  }
}

/**
 * 保存 MCP 配置
 */
export async function saveMCPConfig(config: MCPConfig, workspace: string): Promise<void> {
  const mcpConfigPath = getMCPConfigPath(workspace);
  const content = JSON.stringify(config, null, 2);
  await fs.writeFile(mcpConfigPath, content, 'utf-8');
  logger.info(`MCP config saved to ${mcpConfigPath}`);
}

/**
 * 创建默认 MCP 配置
 */
export function createDefaultMCPConfig(): MCPConfig {
  return {
    enabled: false,
    servers: [],
  };
}

export class MCPToolLoader {
  async load(config: Config, toolRegistry: ToolRegistry): Promise<MCPManager | undefined> {
    const mcpConfig = await loadMCPConfig(config.agents.defaults.workspace);

    if (!mcpConfig?.enabled) {
      logger.debug('MCP is not enabled');
      return undefined;
    }

    if (mcpConfig.servers.length === 0) {
      logger.debug('No MCP servers configured');
      return undefined;
    }

    const manager = new MCPManager();
    await manager.connectAll(mcpConfig.servers);

    const wrapper = new MCPToolWrapper(manager);
    const mcpTools = wrapper.wrapMCPTools();

    for (const tool of mcpTools) {
      try {
        toolRegistry.register(tool);
        logger.info(`Registered MCP tool: ${tool.name}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`Failed to register MCP tool "${tool.name}": ${errorMsg}`);
      }
    }

    const serverCount = manager.getServerCount();
    const toolCount = mcpTools.length;
    logger.info(`Loaded ${toolCount} tools from ${serverCount} MCP server(s)`);

    return manager;
  }

  async disconnect(manager: MCPManager): Promise<void> {
    await manager.disconnectAll();
  }

  getManager(manager: MCPManager): MCPManager | undefined {
    return manager ?? undefined;
  }
}
