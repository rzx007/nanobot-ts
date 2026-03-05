# nanobot-ts

 [中文](README_CN.md)


Ultra-lightweight personal AI assistant - TypeScript implementation

## 🎯 Overview

nanobot-ts is the TypeScript version of [nanobot](https://github.com/HKUDS/nanobot), an ultra-lightweight personal AI assistant framework.

### Key Features

- 🪶 **Lightweight**: ~5000 lines of TypeScript code
- 🚀 **Fast**: Powered by Bun runtime
- 🔌 **Multi-channel**: WhatsApp, Feishu, Email, CLI
- 🧠 **Smart**: LLM-driven with tool calling
- 🛠️ **Extensible**: Easy to add custom tools and channels
- 🔐 **Safe**: Risk-based tool approval system
- 🔌 **MCP Support**: Model Context Protocol for external tools
- 🎨 **Type-safe**: Full TypeScript support with Zod validation
- 🤖 **AI SDK**: Powered by Vercel AI SDK
- 💾 **Memory**: Automatic session consolidation and long-term memory
- ⏰ **Cron**: Built-in scheduled task execution system
- 🖥️ **TUI**: Modern terminal interface with slash commands and search

### Comparison with Python Version

| Feature       | Python Version | TypeScript Version               |
| ------------- | -------------- | -------------------------------- |
| Lines of Code | ~4,000         | ~5,000                           |
| Runtime       | Python 3.11+   | Bun 1.3+                         |
| Type Safety   | Optional       | ✅ Full                          |
| Performance   | Good           | ✅ Better (async I/O)            |
| Ecosystem     | PyPI           | ✅ npm (larger)                  |
| Channels      | 9+             | 4 (WhatsApp, Feishu, Email, CLI) |
| LLM SDK       | LiteLLM        | ✅ Vercel AI SDK                 |
| Approval      | ✅             | ✅ Risk-based approval           |
| MCP Support   | ✅             | ✅ stdio + HTTP servers          |

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
      "timeout": 60
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
nanobot

# Start gateway with cli command
nanobot gateway

# Single-shot message
nanobot chat "Hello!"

# Interactive mode (CLI-based)
nanobot chat --interactive
```

### TUI Mode

The `nanobot gateway` command now includes a modern Terminal User Interface (TUI) powered by opentui:

**Features**:
- 🎨 **Beautiful Interface**: Modern TUI with responsive design
- 💬 **Chat Interface**: Real-time chat with message history
- 🎯 **Slash Commands**: Quick access to commands with `/` prefix
- 🔍 **Command Search**: Filter commands by typing after `/`
- 📜 **Message History**: Automatically loads from session storage
- ⚙️ **Configuration**: Built-in config and settings management
- 🎨 **Theme Support**: Customizable themes

**Slash Commands**:

| Command | Description |
|---------|-------------|
| `/new` | Start a new session (archives current history) |
| `/help` | Show help information |
| `/status` | View system status and sessions |
| `/models` | Configure AI models |
| `/themes` | Change UI themes |
| `/sessions` | Manage chat sessions |
| `/init` | Initialize configuration |
| `/mcps` | Manage MCP servers |
| `/review` | Review conversation history |
| `/skills` | Manage skills |

**Usage**:
1. Type `/` in the chat input to see all available commands
2. Type `/` followed by text to search (e.g., `/stat` to find `/status`)
3. Use arrow keys to navigate, Enter to select
4. Press Escape to close the command popover

## 💻 CLI Commands

| Command                                              | Description                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| `nanobot init`                                       | Initialize config & workspace in `~/.nanobot`, use `-f/--force` to overwrite |
| `nanobot chat [prompt]`                              | Send a prompt and get reply; add `-i/--interactive` for interactive mode     |
| `nanobot gateway`                                    | Start message bus and Agent (default port: `--port 18790`)                   |
| `nanobot status`                                     | View configuration and runtime status                                        |
| `nanobot session`                                    | List all sessions                                                            |
| `nanobot config [key] [value]`                       | View or set config (e.g., `agents.defaults.model`)                           |
| `nanobot channels status`                            | Check channel status                                                         |
| `nanobot logs`                                       | View logs, use `-t/--tail <n>` (default 50)                                  |
| `nanobot whatsapp:auth`                              | WhatsApp QR code / pairing code login                                        |
| `nanobot whatsapp:status`                            | Check WhatsApp login status                                                  |
| `nanobot whatsapp:logout`                            | Clear WhatsApp credentials                                                   |
| `nanobot mcp:list`                                   | List connected MCP servers and tools                                         |
| `nanobot mcp:tools`                                  | List MCP tools in nanobot format                                             |
| `nanobot mcp:test <serverName> <toolName> [args...]` | Test specific MCP tool                                                       |

### Examples

```bash
# Initialize or reinitialize
nanobot init
nanobot init --force

# Chat with AI
nanobot chat "Help me write a Python function"
nanobot chat -i

# Start gateway with custom port
nanobot gateway --port 8080

# Check status
nanobot status
nanobot channels status

# View logs
nanobot logs
nanobot logs --tail 100

# Configure model
nanobot config get
nanobot config set agents.defaults.model openai:gpt-4o

# WhatsApp authentication
nanobot whatsapp:auth
nanobot whatsapp:auth --pairing-code --phone 86123456789
nanobot whatsapp:status
nanobot whatsapp:logout

# MCP operations
nanobot mcp:list
nanobot mcp:tools
nanobot mcp:test filesystem read_file '{"path":"~/test.txt"}'
```

### WhatsApp Authentication

```bash
# Authenticate with QR code (default)
nanobot whatsapp:auth

# Authenticate with pairing code
nanobot whatsapp:auth --pairing-code --phone 86123456789

# Force re-authentication
nanobot whatsapp:auth --force

# Check authentication status
nanobot whatsapp:status

# Clear authentication (logout)
nanobot whatsapp:logout
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
nanobot whatsapp:auth

# Pairing code login
nanobot whatsapp:auth --pairing-code --phone 86123456789

# Force re-authentication
nanobot whatsapp:auth --force

# Check authentication status
nanobot whatsapp:status

# Clear authentication (logout)
nanobot whatsapp:logout
```

**Authentication Flow**:

1. Run `nanobot whatsapp:auth`
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

| Tool          | Description                       |
| ------------- | --------------------------------- |
| `read_file`   | Read file contents                |
| `write_file`  | Write to file                     |
| `edit_file`   | Edit specific lines in file       |
| `delete_file` | Delete file                       |
| `list_dir`    | List directory contents           |
| `exec`        | Execute shell commands            |
| `web_search`  | Search the web (Brave Search API) |
| `web_fetch`   | Fetch web page content            |
| `message`     | Send message to specific channel  |
| `spawn`       | Spawn background sub-agent        |
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

## 🎨 Development

```bash
# Development mode (with watch)
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Test with coverage
pnpm test:coverage

# Lint
pnpm lint

# Format code
pnpm format

# Type check
pnpm typecheck
```

## 📊 Project Structure

```
nanobot-ts/
├── src/                    # Source code
│   ├── core/               # Core agent logic
│   ├── bus/                # Message bus
│   ├── channels/           # Channel implementations
│   ├── tools/              # Tool system
│   ├── providers/          # LLM providers
│   ├── config/             # Configuration
│   ├── storage/            # Storage layer
│   ├── cli/                # CLI commands
│   │   └── tui/            # Terminal User Interface
│   │       ├── commands/   # Slash command handlers
│   │       ├── components/ # TUI React components
│   │       └── hooks/      # Custom React hooks
│   ├── cron/               # Scheduled task service
│   └── utils/              # Utilities
├── templates/               # Workspace templates
├── tests/                  # Test files
├── docs/                   # Documentation
└── package.json
```

## 📚 Documentation

- [Gateway Flow Documentation](docs/GATEWAY_FLOW.md) - Detailed message flow diagrams
- [Mermaid Diagrams](docs/GATEWAY_MERMAID.md) - Visual architecture diagrams
- [Feishu Channel Guide](docs/FEISHU.md) - Feishu channel configuration
- [MCP Configuration](MCP.md) - Model Context Protocol setup
- [Cron Service](src/cron/README.md) - Scheduled task execution system
- [TUI Slash Commands](src/cli/tui/commands/README.md) - Terminal user interface command system

## 📄 License

MIT

## 🙏 Acknowledgments

- Original Python version: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
- Test framework: [Vitest](https://vitest.dev/)
