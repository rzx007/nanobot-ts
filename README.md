# nanobot-ts

[中文](README_CN.md)

Ultra-lightweight personal AI assistant - TypeScript implementation

## 🎯 Overview

nanobot-ts is the TypeScript version of [nanobot](https://github.com/HKUDS/nanobot), an ultra-lightweight personal AI assistant framework.

### Key Features

- 🪶 **Lightweight**: ~5000 lines of TypeScript code
- 🚀 **Fast**: Powered by Bun runtime
- 🏗️ **Monorepo**: Modular architecture with 10+ packages for better organization
- 🔌 **Multi-channel**: WhatsApp, Feishu, Email, CLI
- 🧠 **Smart**: LLM-driven with tool calling
- 🛠️ **Extensible**: Easy to add custom tools, channels, and packages
- 🔐 **Safe**: Risk-based tool approval system
- 🔌 **MCP Support**: Model Context Protocol for external tools
- 🎨 **Type-safe**: Full TypeScript support with Zod validation
- 🤖 **AI SDK**: Powered by Vercel AI SDK
- 💾 **Memory**: Automatic session consolidation and long-term memory
- ⏰ **Cron**: Built-in scheduled task execution system
- 🖥️ **TUI**: Modern terminal interface with slash commands and search
- 🤖 **Subagent**: High-performance background task processing with embedded/isolated modes
- 🌐 **Web UI**: React + Vite dashboard for web-based management

### Comparison with Python Version

| Feature       | Python Version | TypeScript Version               |
| ------------- | -------------- | -------------------------------- |
| Lines of Code | ~4,000         | ~5,000                           |
| Runtime       | Python 3.11+   | Bun 1.3+                         |
| Architecture  | Single repo    | ✅ Monorepo (10+ packages)       |
| Type Safety   | Optional       | ✅ Full                          |
| Performance   | Good           | ✅ Better (async I/O)            |
| Ecosystem     | PyPI           | ✅ npm (larger)                  |
| Channels      | 9+             | 4 (WhatsApp, Feishu, Email, CLI) |
| LLM SDK       | LiteLLM        | ✅ Vercel AI SDK                 |
| Approval      | ✅             | ✅ Risk-based approval           |
| MCP Support   | ✅             | ✅ stdio + HTTP servers          |
| Web UI        | ❌             | ✅ React + Vite Dashboard        |

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/nanobot-ts.git
cd nanobot-ts

# Install dependencies (需要先安装 Bun: https://bun.sh)
bun install

# Build the project
bun run build
```

### Initialize

```bash
# Setup in first run
bun run start
```

This will create:

- `~/.nanobot/config.json` - Configuration file
- `~/.nanobot/workspace/` - Workspace directory
- Template files in workspace

### Configure

Edit `~/.nanobot/config.json`:

```json
{
  "agents": {
    "defaults": {
      "model": "openai:gpt-4o",
      "temperature": 0.1,
      "maxTokens": 8192,
      "maxIterations": 40,
      "memoryWindow": 100
    }
  },
  "providers": {
    "openai": {
      "apiKey": "sk-..."
    }
  },
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  },
   "tools": {
     "approval": {
       "enabled": true,
       "memoryWindow": 300,
       "timeout": 60,
     },
     "subagent": {
       "enabled": true,
       "mode": "embedded",
       "concurrency": 3,
       "maxIterations": 15,
       "timeout": 300,
       "dataPath": "./data/bunqueue.db"
     },
  }
  }
}
```

For MCP configuration, create `~/.nanobot/workspace/mcp.json`:

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "filesystem",
      "type": "stdio",
      "stdio": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem"],
        "env": {
          "FILESYSTEM_ALLOWED_DIRECTORIES": "/workspace"
        }
      }
    }
  ]
}
```

### Run

```bash
# Start gateway with TUI (Terminal User Interface)
nanobot-ts

# Start gateway with cli command
nanobot-ts gateway

# Single-shot message
nanobot-ts chat "Hello!"

# Interactive mode (CLI-based)
nanobot-ts chat --interactive
```

### TUI Mode

The `nanobot-ts gateway` command now includes a modern Terminal User Interface (TUI) powered by opentui:

**Features**:

- 🎨 **Beautiful Interface**: Modern TUI with responsive design
- 💬 **Chat Interface**: Real-time chat with message history
- 🎯 **Slash Commands**: Quick access to commands with `/` prefix
- 🔍 **Command Search**: Filter commands by typing after `/`
- 📜 **Message History**: Automatically loads from session storage
- ⚙️ **Configuration**: Built-in config and settings management
- 🎨 **Theme Support**: Customizable themes

**Slash Commands**:

| Command     | Description                                    |
| ----------- | ---------------------------------------------- |
| `/new`      | Start a new session (archives current history) |
| `/help`     | Show help information                          |
| `/status`   | View system status and sessions                |
| `/models`   | Configure AI models                            |
| `/themes`   | Change UI themes                               |
| `/sessions` | Manage chat sessions                           |
| `/init`     | Initialize configuration                       |
| `/mcps`     | Manage MCP servers                             |
| `/review`   | Review conversation history                    |
| `/skills`   | Manage skills                                  |

**Usage**:

1. Type `/` in the chat input to see all available commands
2. Type `/` followed by text to search (e.g., `/stat` to find `/status`)
3. Use arrow keys to navigate, Enter to select
4. Press Escape to close the command popover

## 💻 CLI Commands

| Command                           | Description                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `nanobot-ts init`                 | Initialize config & workspace in `~/.nanobot`, use `-f/--force` to overwrite |
| `nanobot-ts chat [prompt]`        | Send a prompt and get reply; add `-i/--interactive` for interactive mode     |
| `nanobot-ts gateway`              | Start message bus and Agent (default port: `--port 18790`)                   |
| `nanobot-ts status`               | View configuration and runtime status                                        |
| `nanobot-ts session`              | List all sessions                                                            |
| `nanobot-ts config [key] [value]` | View or set config (e.g., `agents.defaults.model`)                           |
| `nanobot-ts channels status`      | Check channel status                                                         |
| `nanobot-ts logs`                 | View logs, use `-t/--tail <n>` (default 50)                                  |
| `nanobot-ts whatsapp:auth`        | WhatsApp QR code / pairing code login                                        |
| `nanobot-ts whatsapp:status`      | Check WhatsApp login status                                                  |
| `nanobot-ts whatsapp:logout`      | Clear WhatsApp credentials                                                   |
| `nanobot-ts mcp:list`             | List connected MCP servers and tools                                         |

### Examples

```bash
# Initialize or reinitialize
nanobot-ts init
nanobot-ts init --force

# Chat with AI
nanobot-ts chat "Help me write a Python function"
nanobot-ts chat -i

# Start gateway with custom port
nanobot-ts gateway --port 8080

# Check status
nanobot-ts status
nanobot-ts channels status

# View logs
nanobot-ts logs
nanobot-ts logs --tail 100

# Configure model
nanobot-ts config get
nanobot-ts config set agents.defaults.model openai:gpt-4o

# WhatsApp authentication
nanobot-ts whatsapp:auth
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789
nanobot-ts whatsapp:status
nanobot-ts whatsapp:logout

# MCP operations
nanobot-ts mcp:list
```

### WhatsApp Authentication

```bash
# Authenticate with QR code (default)
nanobot-ts whatsapp:auth

# Authenticate with pairing code
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789

# Force re-authentication
nanobot-ts whatsapp:auth --force

# Check authentication status
nanobot-ts whatsapp:status

# Clear authentication (logout)
nanobot-ts whatsapp:logout
```

## 📦 Architecture

nanobot-ts follows an event-driven architecture with a message bus at its core:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           User Layer (Channels)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │   CLI      │  │ WhatsApp   │  │  Feishu    │  │   Email    │        │
│  │  Channel   │  │  Channel   │  │  Channel   │  │  Channel   │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
└────────┼────────────────┼────────────────┼────────────────┼────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Message Bus (Queue System)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Inbound Queue: User → Agent                                              │
│  • Outbound Queue: Agent → User                                             │
│  • Approval Filter: Intercepts yes/no responses                             │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Loop (Processing)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Session    │  │    Memory    │  │    Skills    │  │   Context    │ │
│  │   Manager    │  │Consolidator  │  │   Loader    │  │   Builder    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Tool       │  │  Approval    │  │   Cron       │  │     MCP      │ │
│  │  Registry    │  │  Manager    │  │   Service    │  │   Manager    │ │
│  │              │  │              │  │              │  │              │ │
│  │ • File Tools │  │ • Risk-based │  │ • Scheduled  │  │ • stdio      │ │
│  │ • Shell      │  │ • Memory     │  │   tasks      │  │   servers    │ │
│  │ • Web        │  │ • Per-tool   │  │ • Persistent │  │ • HTTP       │ │
│  │ • Message    │  │   overrides │  │   storage    │  │   servers    │ │
│  │ • Spawn      │  │              │  │ • One-time   │  │              │ │
│  │ • MCP Tools  │  │              │  │ • Recurring  │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    TUI       │  │   Slash      │  │  Message     │  │   Theme      │ │
│  │   System     │  │  Commands    │  │   History    │  │   Manager    │ │
│  │              │  │              │  │              │  │              │ │
│  │ • opentui    │  │ • /new       │  │ • Sessions   │  │ • Color      │ │
│  │ • React      │  │ • /help      │  │ • Loading    │  │ • Styles     │ │
│  │ • Layout     │  │ • /status    │  │ • Persistence│  │ • Dynamic    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM Provider (Vercel AI SDK)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │   OpenAI   │  │ Anthropic  │  │ OpenRouter │  │   DeepSeek │         │
│  │   (GPT-4)  │  │  (Claude)  │  │ (All Mdl)  │  │  (DeepSeek) │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

1. **Message Bus**: Central pub/sub system with inbound/outbound queues
2. **Agent Loop**: Main processing engine that handles LLM interaction and tool execution
3. **Tool Registry**: Manages built-in tools and dynamically loads MCP tools
4. **Approval Manager**: Risk-based tool approval with channel-specific handlers
5. **Session Manager**: Manages conversation state and history
6. **Memory Consolidator**: Automatic session summarization and long-term memory
7. **Channel Manager**: Multi-channel support with unified interface
8. **Cron Service**: Scheduled task execution with persistent storage
9. **TUI System**: Modern terminal interface with slash commands

### Tool Execution Flow

```
LLM Decision → Tool Registry → Approval Check → Execute → Return Result
                                    ↓
                              User Approval
                                    ↓
                           (via CLI/WhatsApp/Feishu/Email)
```

For detailed architecture diagrams and flows, see:

- [Gateway Flow Documentation](docs/GATEWAY_FLOW.md)
- [Mermaid Diagrams](docs/GATEWAY_MERMAID.md)

## 🔌 Channels

### WhatsApp

- **Library**: `baileys`
- **Features**: QR code login, pairing code login, message handling, media support

**Authentication**:

```bash
# QR code login (default)
nanobot-ts whatsapp:auth

# Pairing code login
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789

# Force re-authentication
nanobot-ts whatsapp:auth --force

# Check authentication status
nanobot-ts whatsapp:status

# Clear authentication (logout)
nanobot-ts whatsapp:logout
```

**Authentication Flow**:

1. Run `nanobot-ts whatsapp:auth`
2. Scan QR code with WhatsApp on your phone
   - Open WhatsApp → Settings → Linked Devices → Link a Device
   - Or use pairing code mode
3. Credentials are saved to `~/.nanobot/whatsapp_auth/`
4. Enable WhatsApp in config and start gateway

**Timeout Handling**:

- **Auto-retry**: Up to 5 automatic retries on timeout
- **Exponential backoff**: 3s, 6s, 9s, 12s, 15s delays
- **Retry info**: Shows current retry count and delay

```bash
# Example retry output
⚠️  二维码已超时，3 秒后重试 (1/5)...
```

**Recommendation**: Use pairing code mode for better timeout handling (longer validity period).

**Configuration**:

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"],
      "usePairingCode": false,
      "phoneNumber": "86123456789"
    }
  }
}
```

### Feishu

- **Library**: `@larksuiteoapi/node-sdk`
- **Features**: WebSocket 长连接接收消息，API 发送消息；无需公网 IP
- **配置说明**: 见 [飞书渠道配置指南](docs/FEISHU.md)

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": []
    }
  }
}
```

### Email

- **Library**: `imapflow` + `nodemailer`
- **Features**: IMAP polling, SMTP sending

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "imapHost": "imap.gmail.com",
      "imapUsername": "bot@gmail.com",
      "imapPassword": "app-password",
      "smtpHost": "smtp.gmail.com",
      "smtpUsername": "bot@gmail.com",
      "smtpPassword": "app-password",
      "fromAddress": "bot@gmail.com"
    }
  }
}
```

## 🤖 LLM Providers

Supported providers (powered by Vercel AI SDK):

- ✅ OpenAI (GPT-4, GPT-4o, GPT-3.5)
- ✅ Anthropic (Claude 3.5, Claude 3, Claude Opus)
- ✅ OpenRouter (Access to all models)
- ✅ Google (Gemini 1.5)
- ✅ DeepSeek
- ✅ Groq
- ✅ And more...

## 🛠️ Tools

### Built-in Tools

| Tool          | Description                                            |
| ------------- | ------------------------------------------------------ |
| `read_file`   | Read file contents                                     |
| `write_file`  | Write to file                                          |
| `edit_file`   | Edit specific lines in file                            |
| `delete_file` | Delete file                                            |
| `list_dir`    | List directory contents                                |
| `exec`        | Execute shell commands                                 |
| `web_search`  | Search the web (Brave Search API)                      |
| `web_fetch`   | Fetch web page content                                 |
| `message`     | Send message to specific channel                       |
| `spawn`       | **[Deprecated]** Use `subagent` tool instead           |
| `subagent`    | Execute background tasks with dual-mode architecture   |
| `cron`        | Schedule and manage cron tasks with persistent storage |

### MCP Tools

Connect to external MCP (Model Context Protocol) servers to extend nanobot's capabilities:

- ✅ Supports both local (STDIO) and remote (HTTP) servers
- ✅ OAuth authentication for protected endpoints
- ✅ Automatic tool loading and registration
- ✅ See [MCP.md](MCP.md) for configuration details

### Tool Approval System

Risk-based approval system for tool execution:

- **High Risk**: Always requires approval
- **Medium Risk**: Checks approval memory (configurable timeout)
- **Low Risk**: No approval required
- **Per-tool overrides**: Override risk level per tool
- **Strict mode**: All non-LOW risk tools require approval
- **Channel-specific handlers**: CLI, WhatsApp, Feishu, Email

Configuration example:

```json
{
  "tools": {
    "approval": {
      "enabled": true,
      "memoryWindow": 300,
      "timeout": 60,
      "strictMode": false,
      "toolOverrides": {
        "exec": { "requiresApproval": true }
      }
    }
  }
}
```

### Subagent Tool

The `subagent` tool provides high-performance background task processing with dual execution modes:

**Architecture**:

- 🏗️ **Built on bunqueue**: High-performance task queuing (286K ops/sec embedded, 149K ops/sec isolated)
- 🔀 **Dual Execution Modes**:
  - **Embedded** (default): Same-process execution for maximum performance
  - **Isolated**: Process-isolated execution with auto-restart for safety
- 🎯 **Tool Filtering**: Automatically excludes `spawn` and `message` tools to prevent infinite recursion
- 📊 **Result Notification**: Subagent results published via MessageBus as system messages from 'subagent' sender
- 💾 **Task Persistence**: Uses bunqueue's SQLite WAL mode for reliable task queuing
- ⚙️ **Configurable Settings**: Concurrency, max iterations, timeout, data path

**Configuration**:

```json
{
  "tools": {
    "subagent": {
      "enabled": true,
      "mode": "embedded",
      "concurrency": 3,
      "maxIterations": 15,
      "timeout": 300,
      "dataPath": "./data/bunqueue.db"
    }
  }
}
```

**Usage Example**:

```bash
# Enable subagent via config
nanobot-ts config set tools.subagent.enabled true
nanobot-ts config set tools.subagent.mode isolated

# Use subagent in conversation
$ nanobot-ts gateway
User: Analyze this project for security issues
Bot: I'll use the subagent tool to analyze the code in the background...

[Background execution with subagent]

User: Check task status
Bot: Task "security analysis" completed successfully
```

**Configuration Priority**: `CLI args > config file > defaults`

**Key Features**:

- **Embedded Mode**: Fastest performance (286K ops/sec), same-process execution
- **Isolated Mode**: Process-isolated execution (149K ops/sec), auto-restart on failure
- **Automatic Tool Filtering**: Prevents infinite recursion by excluding dangerous tools
- **Memory Integration**: Automatic context sharing with main agent session
- **Flexible Configuration**: Runtime settings without code changes

**Documentation**:

- [Subagent Implementation Plan](docs/subagent-implementation.md)
- [Subagent Usage Guide](docs/subagent-usage.md)
- [Subagent Feature Checklist](docs/subagent-feature-checklist.md)
- [Subagent Final Verification](docs/subagent-full-final-verification.md)

## 🏗️ Monorepo Architecture

nanobot-ts uses a monorepo structure with Bun workspaces for better code organization and modularity.

### Core Packages

| Package | Description | Main Features |
|---------|-------------|---------------|
| `@nanobot/main` | Core framework | Agent loop, memory, tools, skills, MCP, cron, approval |
| `@nanobot/cli` | CLI tool | Command parsing, entry point, WhatsApp auth |
| `@nanobot/tui` | Terminal UI | opentui-based interface, slash commands |
| `@nanobot/channels` | Message channels | WhatsApp, Feishu, Email, CLI |
| `@nanobot/providers` | LLM providers | OpenAI, Anthropic, OpenRouter, etc. |
| `@nanobot/server` | HTTP server | REST API, web server middleware |
| `web` | Web Dashboard | React + Vite frontend (independent) |
| `@nanobot/shared` | Shared types | Config schemas, types, defaults |
| `@nanobot/logger` | Logging utility | Console and file logging |
| `@nanobot/utils` | Utilities | Helpers, retry logic, error handling |

### Building and Publishing

All packages are built using Bun:

```bash
# Build all packages
bun build

# Build specific package
cd packages/cli && bun run build

# Type check specific package
cd packages/main && bun run typecheck
```

### Workspace Benefits

- **Modularity**: Clear separation of concerns
- **Maintainability**: Easier to locate and fix issues
- **Reusability**: Packages can be used independently
- **Testing**: Test each package in isolation
- **Performance**: Build only what changes

### Adding a New Package

1. Create package directory: `packages/new-package/`
2. Add `package.json` with proper exports
3. Add TypeScript config if needed
4. Update root `package.json` workspaces (optional, auto-discovered)
5. Import using package name: `@nanobot/new-package`

### Migration from Single Repo

The project was migrated from a single `src/` directory to a monorepo structure. See [MIGRATION.md](MIGRATION.md) for details.

## 🎨 Development

```bash
# Development mode (with watch for CLI)
bun dev

# Build all packages
bun build

# Build CLI binary
bun run build:binary

# Run tests
bun test

# Test with coverage
bun test:coverage

# Test in watch mode
bun test:watch

# Lint all packages
bun lint

# Lint with auto-fix
bun lint:fix

# Format code
bun format

# Type check all packages
bun typecheck

# Clean build artifacts
bun clean

# Quick start commands
bun onboard           # Initialize config
bun agent             # Interactive chat mode
bun gateway           # Start gateway
bun status            # View status
```

**Package-specific Development**:

```bash
# Work on specific package (from root)
cd packages/main && bun run typecheck
cd packages/cli && bun run build
cd packages/tui && bun run dev
cd packages/web && bun run dev
```

## 📊 Project Structure

nanobot-ts is organized as a monorepo using Bun workspaces:

```
nanobot-ts/
├── packages/               # Monorepo packages
│   ├── main/               # Core framework (Agent, Memory, Tools, Skills, MCP)
│   │   ├── src/
│   │   │   ├── core/       # Core agent logic
│   │   │   ├── bus/        # Message bus implementation
│   │   │   ├── tools/      # Built-in tools
│   │   │   ├── storage/    # Storage layer
│   │   │   ├── skills/     # Skill system
│   │   │   ├── cron/       # Scheduled task service
│   │   │   └── mcp/        # MCP integration
│   ├── cli/                # CLI tool and commands
│   │   ├── src/
│   │   │   ├── commands/   # CLI command handlers
│   │   │   └── whatsapp-auth.ts
│   ├── tui/                # Terminal User Interface (opentui)
│   │   ├── src/
│   │   │   ├── components/ # TUI React components
│   │   │   ├── commands/   # Slash command handlers
│   │   │   ├── hooks/      # Custom React hooks
│   │   │   ├── gateway/    # Gateway UI
│   │   │   └── home/       # Home screen
│   ├── channels/           # Message channels
│   │   ├── src/
│   │   │   ├── base.ts     # Base channel interface
│   │   │   ├── cli.ts      # CLI channel
│   │   │   ├── whatsapp.ts # WhatsApp channel
│   │   │   ├── feishu.ts   # Feishu channel
│   │   │   └── email.ts    # Email channel
│   ├── providers/          # LLM providers
│   │   ├── src/
│   │   │   ├── adapters/   # Provider adapters
│   │   │   └── registry.ts # Provider registry
│   ├── server/             # HTTP server
│   │   ├── src/
│   │   │   ├── routes/     # API routes
│   │   │   └── middleware/ # Server middleware
│   ├── web/                # Web Dashboard (React + Vite)
│   │   ├── src/
│   │   │   ├── components/ # Web UI components
│   │   │   └── lib/        # Utility functions
│   ├── shared/             # Shared types and configuration
│   │   ├── src/
│   │   │   ├── config/     # Config schemas and defaults
│   │   │   └── loader.ts   # Config loader
│   ├── logger/             # Logging utility
│   │   └── src/
│   │       └── logger.ts   # Logger implementation
│   ├── utils/              # Utility functions
│   │   └── src/
│   │       ├── errors.ts   # Error handling
│   │       ├── helpers.ts  # Helper functions
│   │       └── retry.ts    # Retry logic
│   └── workspace/          # Workspace templates and examples
│       ├── AGENTS.md       # Agent configuration guide
│       ├── TOOLS.md        # Tools configuration guide
│       ├── skills/         # Example skills
│       └── memory/         # Memory storage
├── tests/                  # Test files
├── docs/                   # Documentation
├── package.json            # Root package (monorepo config)
└── bun.lock                # Lockfile
```

```
CLI Entry Point (@nanobot/cli)
    │
    ├──> TUI (@nanobot/tui) ──────────────────────┐
    │                                            │
    └──> Main (@nanobot/main)                     │
          ├── Core (Agent, Memory, Skills)       │
          ├── Bus (Message Queue System)          │
          ├── Tools (Built-in + MCP)              │
          ├── Cron (Scheduled Tasks)              │
          ├── Subagent (Background Processing)    │
          └── Approval (Risk-based System)        │
                │                                │
                ├──> Providers (@nanobot/providers)
                │     ├── OpenAI
                │     ├── Anthropic
                │     └── OpenRouter
                │
                ├──> Channels (@nanobot/channels)
                │     ├── CLI
                │     ├── WhatsApp
                │     ├── Feishu
                │     └── Email
                │
                ├──> Shared (@nanobot/shared)
                │     └── Types & Config
                │
                ├──> Logger (@nanobot/logger)
                │     └── Logging
                │
                └──> Utils (@nanobot/utils)
                      └── Helpers
```

**Monorepo Architecture Benefits**:

- 🏗️ **Modular Design**: Each package has a clear responsibility
- 🔗 **Clear Dependencies**: Packages depend only on what they need
- 🚀 **Faster Development**: Build and test only what changes
- 📦 **Better Organization**: Easier to understand and maintain
- 🔄 **Scalability**: Add new packages without affecting existing ones

**Package Dependencies**:

```
cli ──┬──> main
       ├──> tui
       ├──> channels
       └──> logger

tui ──> main
       ├──> shared
       └── logger

server ──> main
          ├──> channels
          └── utils

main ──┬──> shared
       ├──> providers
       ├──> channels
       ├──> logger
       └──> utils

web (independent) ──> No direct dependencies
                      (communicates via HTTP API)

shared ──> No dependencies
logger ──> No dependencies
utils ──> No dependencies
```


## 📚 Documentation

### Architecture & Design
- [Gateway Flow Documentation](docs/GATEWAY_FLOW.md) - Detailed message flow diagrams
- [Mermaid Diagrams](docs/GATEWAY_MERMAID.md) - Visual architecture diagrams
- [Multi-Agent Architecture](docs/MULIT-AGEBTS-ARCH.md) - Multi-agent system design

### Configuration & Setup
- [Feishu Channel Guide](docs/FEISHU.md) - Feishu channel configuration
- [MCP Configuration](docs/MCP.md) - Model Context Protocol setup
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment instructions
- [Monorepo Migration](MIGRATION.md) - Migration from single repo to monorepo

### Features
- [Cron Service](packages/main/src/cron/README.md) - Scheduled task execution system
- [TUI Slash Commands](packages/tui/src/commands/README.md) - Terminal user interface command system
- [Subagent Implementation](docs/subagent-implementation.md) - Background task processing architecture
- [Subagent Usage Guide](docs/subagent-usage.md) - Configuration and usage examples
- [Skill System](docs/SKILL-SYSTEM.md) - Skill-based architecture
- [Approval Flow](docs/APPROVAL-FLOW.md) - Risk-based tool approval system

### Development
- [API Documentation](docs/API.md) - API reference
- [Agent Patterns](docs/AGENT-PATTERNS.md) - Common agent patterns
- [Browser Automation](docs/browser-automation-plan.md) - Browser automation with agent-browser

### Migration & Upgrades
- [Bun Migration](docs/BUN_MIGRATION.md) - Migration to Bun runtime
- [TUI Migration](docs/TUI_MIGRATION.md) - Terminal UI migration

## 📄 License

MIT

## 🙏 Acknowledgments

- Original Python version: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
- Test framework: [Vitest](https://vitest.dev/)
