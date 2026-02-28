# nanobot-ts

Ultra-lightweight personal AI assistant - TypeScript implementation

## 🎯 Overview

nanobot-ts is the TypeScript version of [nanobot](https://github.com/HKUDS/nanobot), an ultra-lightweight personal AI assistant framework.

### Key Features

- 🪶 **Lightweight**: ~5000 lines of TypeScript code
- 🚀 **Fast**: Powered by Node.js non-blocking I/O
- 🔌 **Multi-channel**: WhatsApp, Feishu, Email, QQ, CLI
- 🧠 **Smart**: LLM-driven with tool calling
- 🛠️ **Extensible**: Easy to add custom tools and channels
- 🎨 **Type-safe**: Full TypeScript support with Zod validation
- 🔌 **AI SDK**: Powered by Vercel AI SDK

### Comparison with Python Version

| Feature       | Python Version | TypeScript Version              |
| ------------- | -------------- | ------------------------------- |
| Lines of Code | ~4,000         | ~5,000                          |
| Runtime       | Python 3.11+   | Node.js 18+                     |
| Type Safety   | Optional       | ✅ Full                         |
| Performance   | Good           | ✅ Better (async I/O)           |
| Ecosystem     | PyPI           | ✅ npm (larger)                 |
| Channels      | 9+             | 4 (WhatsApp, Feishu, Email, QQ) |
| LLM SDK       | LiteLLM        | ✅ Vercel AI SDK                |

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/nanobot-ts.git
cd nanobot-ts

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

### Initialize

```bash
# Run the initialization wizard
pnpm run init
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
  }
}
```

### Run

```bash
# Start gateway (all channels)
nanobot gateway

# Single-shot message
nanobot chat "Hello!"

# Interactive mode
nanobot chat --interactive
```

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

```

┌─────────────────────────────────┐
│ CLI / Gateway │
├─────────────────────────────────┤
│ Channel Manager │
├───────────┬───────────┬────────┤
│ WhatsApp │ Feishu │ Email │
└───────────┴───────────┴────────┘
↕
Message Bus
↕
┌─────────────────────────────────┐
│ Agent Loop │
├─────────────────────────────────┤
│ Context | Memory | Tools │
├─────────────────────────────────┤
│ Vercel AI SDK │
├───────────┬───────────┬────────┤
│ OpenAI │ Anthropic │OpenRouter│
└───────────┴───────────┴────────┘

```

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

### ~~QQ~~ (暂未实现)



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

Built-in tools:

| Tool         | Description                       |
| ------------ | --------------------------------- |
| `read_file`  | Read file contents                |
| `write_file` | Write to file                     |
| `edit_file`  | Edit specific lines in file       |
| `list_dir`   | List directory contents           |
| `exec`       | Execute shell commands            |
| `web_search` | Search the web (Brave Search API) |
| `web_fetch`  | Fetch web page content            |
| `message`    | Send message to specific channel  |
| `spawn`      | Spawn background sub-agent        |

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
│   └── utils/              # Utilities
├── templates/               # Workspace templates
├── tests/                  # Test files
├── docs/                   # Documentation
└── package.json
```

### MCP Tools

Connect to external MCP (Model Context Protocol) servers to extend nanobot's capabilities:

- ✅ Supports both local (STDIO) and remote (HTTP) servers
- ✅ OAuth authentication for protected endpoints
- ✅ Automatic tool loading and registration
- ✅ See [MCP.md](MCP.md) for configuration details

## 📄 License

MIT

## 🙏 Acknowledgments

- Original Python version: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
- Test framework: [Vitest](https://vitest.dev/)


