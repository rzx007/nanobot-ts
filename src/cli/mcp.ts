/**
 * MCP CLI 命令
 */

import { Command } from 'commander';
import { loadConfig } from '../config';
import { MCPManager, loadMCPConfig } from '../mcp';
import { logger } from '../utils/logger';
import { expandHome } from '../utils/helpers';

export function registerMCPCommands(program: Command): void {
  program
    .command('mcp:list')
    .description('List all connected MCP servers and their tools')
    .action(async () => {
      try {
        const config = await loadConfig();

        if (!config) {
          console.log('No config found. Run "nanobot init" first.');
          process.exit(1);
        }

        const mcpConfig = await loadMCPConfig(expandHome(config.agents.defaults.workspace));

        if (!mcpConfig?.enabled) {
          console.log('MCP is not enabled. Set "enabled": true in workspace/mcp.json');
          return;
        }

        if (mcpConfig.servers.length === 0) {
          console.log('No MCP servers configured');
          return;
        }

        const manager = new MCPManager();
        await manager.connectAll(mcpConfig.servers);

        const { MCPToolWrapper } = await import('../mcp');
        const wrapper = new MCPToolWrapper(manager);
        const tools = wrapper.wrapMCPTools();

        const servers = manager.getConnectedServers();

        if (servers.length === 0) {
          console.log('No MCP servers connected');
          await manager.disconnectAll();
          return;
        }

        console.log('\n=== Connected MCP Servers ===\n');

        for (const serverName of servers) {
          const client = manager.getClient(serverName);
          if (client) {
            const serverTools = client.getToolDefinitions();
            console.log(`📦 ${serverName} (${serverTools.length} tools)`);

            for (const tool of tools) {
              console.log(`  • ${tool.name}`);
            }
            console.log('');
          }
        }

        console.log('\n=== Connected MCP Servers ===\n');

        for (const serverName of servers) {
          const client = manager.getClient(serverName);
          if (client) {
            const serverTools = client.getToolDefinitions();
            console.log(`📦 ${serverName} (${serverTools.length} tools)`);

            for (const tool of serverTools) {
              console.log(`  • ${tool.name}`);
              console.log(
                `    ${tool.description?.substring(0, 100)}${tool.description && tool.description.length > 100 ? '...' : ''}`,
              );
            }
            console.log('');
          }
        }

        console.log('\n=== Connected MCP Servers ===\n');

        for (const serverName of servers) {
          const client = manager.getClient(serverName);
          if (client) {
            const serverTools = client.getToolDefinitions();
            console.log(`📦 ${serverName} (${serverTools.length} tools)`);

            for (const tool of serverTools) {
              console.log(`  • ${tool.name}`);
              const desc = tool.description || '';
              const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
              console.log(`    ${shortDesc}`);
            }
            console.log('');
          }
        }

        await manager.disconnectAll();
      } catch (error) {
        logger.error({ error }, 'Failed to list MCP servers');
        process.exit(1);
      }
    });

  program
    .command('mcp:tools')
    .description('Show all tools from MCP servers in nanobot format')
    .action(async () => {
      try {
        const config = await loadConfig();

        if (!config) {
          console.log('No config found. Run "nanobot init" first.');
          process.exit(1);
        }

        const mcpConfig = await loadMCPConfig(expandHome(config.agents.defaults.workspace));

        if (!mcpConfig?.enabled) {
          console.log('MCP is not enabled. Set "enabled": true in workspace/mcp.json');
          return;
        }

        if (mcpConfig.servers.length === 0) {
          console.log('No MCP servers configured');
          return;
        }

        const manager = new MCPManager();
        await manager.connectAll(mcpConfig.servers);

        const { MCPToolWrapper } = await import('../mcp');
        const wrapper = new MCPToolWrapper(manager);
        const tools = wrapper.wrapMCPTools();

        console.log('\n=== MCP Tools for Nanobot ===\n');

        for (const tool of tools) {
          console.log(`Tool: ${tool.name}`);
          console.log(`Description: ${tool.description}`);
          console.log(`Parameters: ${JSON.stringify(tool.parameters, null, 2)}`);
          console.log('---\n');
        }

        await manager.disconnectAll();
      } catch (error) {
        logger.error({ error }, 'Failed to show MCP tools');
        process.exit(1);
      }
    });

  program
    .command('mcp:test <serverName> <toolName> [args...]')
    .description('Test a specific MCP tool')
    .action(async (serverName, toolName, args) => {
      try {
        const config = await loadConfig();

        if (!config) {
          console.log('No config found. Run "nanobot init" first.');
          process.exit(1);
        }

        const mcpConfig = await loadMCPConfig(expandHome(config.agents.defaults.workspace));

        if (!mcpConfig?.enabled) {
          console.log('MCP is not enabled. Set "enabled": true in workspace/mcp.json');
          return;
        }

        const server = mcpConfig.servers.find(s => s.name === serverName);
        if (!server) {
          console.log(`MCP server "${serverName}" not found in workspace/mcp.json`);
          return;
        }

        const manager = new MCPManager();
        await manager.connectServer(server);

        const toolArgs = args.length > 0 ? JSON.parse(args.join(' ')) : {};
        console.log(`\nCalling tool "${toolName}" on server "${serverName}"...`);
        console.log(`Arguments: ${JSON.stringify(toolArgs, null, 2)}\n`);

        const result = await manager.callTool(serverName, toolName, toolArgs);

        console.log('Result:');
        for (const content of result.content) {
          if (content.type === 'text' && content.text) {
            console.log(content.text);
          }
        }

        await manager.disconnectAll();
      } catch (error) {
        logger.error({ error }, 'Failed to test MCP tool');
        process.exit(1);
      }
    });
}
