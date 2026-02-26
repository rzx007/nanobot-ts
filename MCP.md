# MCP Integration Guide

## Overview

Nanobot now supports connecting to external MCP (Model Context Protocol) servers, allowing you to extend its capabilities with tools from the MCP ecosystem.

## Architecture

The MCP integration is organized as follows:

```
src/mcp/
├── types.ts          # MCP type definitions
├── client.ts         # MCP client (supports STDIO and HTTP)
├── manager.ts        # Multi-server management
├── wrapper.ts        # Tool wrapper (converts MCP tools to nanobot tools)
├── loader.ts         # ⭐ Unified loader - loads and registers MCP tools
└── index.ts          # Module exports
```

### Key Components

1. **MCP Client** (`src/mcp/client.ts`)
   - Supports both STDIO and HTTP transports
   - Automatically selects transport based on server configuration
   - OAuth authentication support for HTTP servers

2. **MCP Manager** (`src/mcp/manager.ts`)
   - Manages multiple MCP server connections
   - Handles tool discovery and execution
   - Server lifecycle management

3. **MCP Tool Wrapper** (`src/mcp/wrapper.ts`)
   - Converts MCP tool definitions to nanobot's Tool class
   - Prefixes tool names with server name: `serverName:toolName`

4. **MCP Tool Loader** (`src/mcp/loader.ts`) ⭐
   - **Unified entry point** for loading MCP tools
   - Integrates with nanobot's ToolRegistry
   - Automatically loads tools from `workspace/mcp.json`
   - Used in both gateway and chat modes

### Usage Flow

```
User starts nanobot (gateway or chat)
    ↓
MCPToolLoader.load() reads workspace/mcp.json
    ↓
Connects to all configured MCP servers
    ↓
Wraps and registers tools in ToolRegistry
    ↓
Agent receives all tools including MCP tools
    ↓
LLM can call any tool including MCP tools
```

MCP configuration is stored in your workspace directory as `workspace/mcp.json`, separate from the main `~/.nanobot/config.json`. This allows different workspaces to have different MCP server configurations.

Example `workspace/mcp.json`:

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "filesystem",
      "type": "stdio",
      "stdio": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
      }
    },
    {
      "name": "brave-search",
      "type": "stdio",
      "stdio": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "env": {
          "BRAVE_API_KEY": "your-brave-api-key"
        }
      }
    },
    {
      "name": "context7",
      "type": "http",
      "http": {
        "url": "https://mcp.context7.com/mcp"
      }
    },
    {
      "name": "github",
      "type": "http",
      "http": {
        "url": "https://mcp.github.com/mcp",
        "oauth": {
          "clientId": "your-client-id",
          "clientSecret": "your-client-secret",
          "authorizationEndpoint": "https://github.com/login/oauth/authorize",
          "tokenEndpoint": "https://github.com/login/oauth/access_token"
        }
      }
    }
  ]
}
```

## MCP Server Configuration

Each MCP server in the `servers` array requires:

- `name`: Unique identifier for the server
- `type`: Transport type - either `"stdio"` (local) or `"http"` (remote)

### STDIO Servers (type: "stdio")

When using local MCP servers:

- `stdio.command`: Command to start the server (e.g., `node`, `python`, `npx`)
- `stdio.args`: Array of arguments to pass to the command
- `stdio.env` (optional): Environment variables for the server process
- `stdio.cwd` (optional): Working directory for the server

### HTTP Servers (type: "http")

When connecting to remote MCP servers:

- `http.url`: URL of the remote MCP server endpoint
- `http.oauth` (optional): OAuth configuration for authentication
  - `clientId`: OAuth client ID
  - `clientSecret`: OAuth client secret
  - `authorizationEndpoint`: OAuth authorization endpoint
  - `tokenEndpoint`: OAuth token endpoint

## Configuration Location

The MCP configuration file is located at:

```
~/.nanobot/workspace/mcp.json
```

This separates MCP server configuration from the main config file, allowing:

- Workspace-specific MCP server configurations
- Easier management of multiple projects with different MCP needs
- Cleaner main config file

## Usage

### List Connected MCP Servers

```bash
nanobot mcp:list
```

This will show all connected MCP servers and their available tools:

```
=== Connected MCP Servers ===

📦 filesystem (4 tools)
  • read_file
    Read complete contents of a file
  • write_file
    Write to a file at specified path
  • list_directory
    List contents of a directory
  • get_file_info
    Get detailed information about a file

📦 brave-search (1 tool)
  • brave_search
    Search web using Brave Search API
```

### View MCP Tools in Nanobot Format

```bash
nanobot mcp:tools
```

This shows how MCP tools are converted to Nanobot's tool format.

### Test a Specific MCP Tool

```bash
nanobot mcp:test <serverName> <toolName> [args]
```

Example:

```bash
# Test filesystem read_file tool
nanobot mcp:test filesystem read_file '{"path":"~/test.txt"}'

# Test brave search
nanobot mcp:test brave-search brave_search '{"query":"TypeScript MCP"}'
```

## Using MCP Tools in Nanobot

Once MCP servers are configured in `workspace/mcp.json`, their tools are **automatically loaded and available** when starting Nanobot through:

- `nanobot gateway` - Starts the gateway with all channels and MCP tools
- `nanobot chat` - Single-shot or interactive chat with MCP tools

You can use them in your conversations:

```
You: Read the file ~/test.txt and summarize it
Nanobot: [Calls filesystem:read_file tool]
The file contains information about MCP integration...
```

## Popular MCP Servers

Here are some popular MCP servers you can connect to:

### Official MCP Servers

1. **Filesystem Server (Local)**

   ```json
   {
     "name": "filesystem",
     "type": "stdio",
     "stdio": {
       "command": "npx",
       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
     }
   }
   ```

2. **Brave Search Server (Local)**

   ```json
   {
     "name": "brave-search",
     "type": "stdio",
     "stdio": {
       "command": "npx",
       "args": ["-y", "@modelcontextprotocol/server-brave-search"],
       "env": {
         "BRAVE_API_KEY": "your-api-key"
       }
     }
   }
   ```

3. **Context7 Server (Remote)**

   ```json
   {
     "name": "context7",
     "type": "http",
     "http": {
       "url": "https://mcp.context7.com/mcp"
     }
   }
   ```

4. **GitHub Server (Remote with OAuth)**

   ```json
   {
     "name": "github",
     "type": "http",
     "http": {
       "url": "https://mcp.github.com/mcp",
       "oauth": {
         "clientId": "your-client-id",
         "clientSecret": "your-client-secret",
         "authorizationEndpoint": "https://github.com/login/oauth/authorize",
         "tokenEndpoint": "https://github.com/login/oauth/access_token"
       }
     }
   }
   ```

5. **Brave Search Server**

   ```json
   {
     "name": "brave-search",
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-brave-search"],
     "env": {
       "BRAVE_API_KEY": "your-api-key"
     }
   }
   ```

6. **GitHub Server**
   ```json
   {
     "name": "github",
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-github"],
     "env": {
       "GITHUB_TOKEN": "your-personal-access-token"
     }
   }
   ```

### Custom MCP Servers

To connect your own MCP server, build it first:

```bash
# TypeScript server
npm run build

# Python server
# No build step needed
```

Then configure it in `workspace/mcp.json`:

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "my-custom-server",
      "command": "node",
      "args": ["/absolute/path/to/server/build/index.js"]
    }
  ]
}
```

## Troubleshooting

### STDIO Server Won't Connect

1. Check that the command is correct and the server is accessible
2. Verify environment variables are set correctly
3. Check file paths are absolute
4. Run `nanobot mcp:list` to see connection errors

### HTTP Server Won't Connect

1. Check that the URL is correct and accessible
2. Verify the server is running and accepts connections
3. Check network connectivity to the remote server
4. If using OAuth, verify your OAuth credentials are correct
5. Check for CORS issues if connecting from a browser

### Tools Not Available

### Tools Not Available

1. Ensure `enabled` is set to `true` in `workspace/mcp.json`
2. Verify the server is running correctly by testing it manually
3. Check the server logs for errors

### Tool Execution Fails

1. Test the tool individually: `nanobot mcp:test <server> <tool> '{"arg":"value"}'`
2. Check if required parameters are missing
3. Verify the server has necessary permissions (e.g., file system access)

## Building Your Own MCP Server

If you want to create a custom MCP server for Nanobot, follow the [official MCP documentation](https://modelcontextprotocol.io).

Basic TypeScript example:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
});

server.registerTool(
  'my_tool',
  {
    description: 'My custom tool',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'A message',
        },
      },
      required: ['message'],
    },
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: 'text',
          text: `You said: ${message}`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
```

Build and configure it in Nanobot:

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "my-server",
      "command": "node",
      "args": ["/path/to/my-server/build/index.js"]
    }
  ]
}
```

## Next Steps

- Explore the [MCP Registry](https://modelcontextprotocol.io/registry) for available servers
- Check [MCP Documentation](https://modelcontextprotocol.io/docs) for advanced configurations
- Build your own MCP server to integrate with your specific tools and services
- Create different `workspace/mcp.json` files for different projects with different needs
