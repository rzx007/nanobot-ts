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

| Feature | Python Version | TypeScript Version |
|----------|----------------|-------------------|
| Lines of Code | ~4,000 | ~5,000 |
| Runtime | Python 3.11+ | Node.js 18+ |
| Type Safety | Optional | ✅ Full |
| Performance | Good | ✅ Better (async I/O) |
| Ecosystem | PyPI | ✅ npm (larger) |
| Channels | 9+ | 4 (WhatsApp, Feishu, Email, QQ) |
| LLM SDK | LiteLLM | ✅ Vercel AI SDK |

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
pnpm run onboard
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
# Start the gateway (all channels)
nanobot gateway

# Start agent in CLI mode
nanobot agent --message "Hello!"

# Interactive mode
nanobot agent

# Check status
nanobot status
```

## 📦 Architecture

```
┌─────────────────────────────────┐
│          CLI / Gateway          │
├─────────────────────────────────┤
│        Channel Manager          │
├───────────┬───────────┬────────┤
│  WhatsApp │  Feishu   │ Email  │
└───────────┴───────────┴────────┘
                  ↕
           Message Bus
                  ↕
┌─────────────────────────────────┐
│           Agent Loop            │
├─────────────────────────────────┤
│     Context | Memory | Tools    │
├─────────────────────────────────┤
│       Vercel AI SDK          │
├───────────┬───────────┬────────┤
│   OpenAI  │ Anthropic │OpenRouter│
└───────────┴───────────┴────────┘
```

## 🔌 Channels

### WhatsApp

- **Library**: `baileys`
- **Features**: QR code login, message handling, media support

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  }
}
```

### Feishu

- **Library**: `lark-oapi`
- **Features**: WebSocket long connection, official SDK

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx"
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

### QQ

- **Library**: `botpy-ts`
- **Features**: Official SDK, private chat support

```json
{
  "channels": {
    "qq": {
      "enabled": true,
      "appId": "YOUR_APP_ID",
      "secret": "YOUR_APP_SECRET"
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

Built-in tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write to file |
| `edit_file` | Edit specific lines in file |
| `list_dir` | List directory contents |
| `exec` | Execute shell commands |
| `web_search` | Search the web (Brave Search API) |
| `web_fetch` | Fetch web page content |
| `message` | Send message to specific channel |
| `spawn` | Spawn background sub-agent |

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

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

MIT

## 🙏 Acknowledgments

- Original Python version: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
- Test framework: [Vitest](https://vitest.dev/)

---

**Made with ❤️ by the nanobot-ts team**
