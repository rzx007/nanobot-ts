# nanobot-ts

超轻量级个人 AI 助手 - TypeScript 实现

## 🎯 概述

nanobot-ts 是 [nanobot](https://github.com/HKUDS/nanobot) 的 TypeScript 版本，一个超轻量级的个人 AI 助手框架。

### 主要特性

- 🪶 **轻量级**: 约 5000 行 TypeScript 代码
- 🚀 **快速**: 基于 Bun 运行时
- 🏗️ **Monorepo**: 模块化架构，10+ 个包便于组织
- 🔌 **多渠道**: WhatsApp、飞书、邮箱、CLI
- 🧠 **智能**: LLM 驱动，支持工具调用
- 🛠️ **可扩展**: 轻松添加自定义工具、渠道和包
- 🔐 **安全**: 基于风险等级的工具审批系统
- 🔌 **MCP 支持**: 支持模型上下文协议扩展外部工具
- 🎨 **类型安全**: 完整的 TypeScript 支持和 Zod 验证
- 🤖 **AI SDK**: 基于 Vercel AI SDK
- 💾 **记忆**: 自动会话整合和长期记忆
- ⏰ **定时任务**: 内置定时任务执行系统
- 🖥️ **TUI**: 现代化终端界面，支持斜杠命令和搜索
- 🌐 **Web UI**: React + Vite Dashboard 提供网页端管理

### 与 Python 版本对比

| 特性       | Python 版本 | TypeScript 版本               |
| ---------- | ----------- | ----------------------------- |
| 代码行数   | ~4,000      | ~5,000                        |
| 运行环境   | Python 3.11 | Bun 1.3+                      |
| 架构       | 单仓库      | ✅ Monorepo (10+ 包)          |
| 类型安全   | 可选        | ✅ 完整                       |
| 性能       | 良好        | ✅ 更好（异步 I/O）           |
| 生态       | PyPI        | ✅ npm（更大）                |
| 渠道       | 9+          | 4 (WhatsApp, 飞书, 邮箱, CLI) |
| LLM SDK    | LiteLLM     | ✅ Vercel AI SDK              |
| 审批系统   | ✅          | ✅ 基于风险的审批             |
| MCP 支持   | ✅          | ✅ stdio + HTTP 服务器        |
| Web UI     | ❌          | ✅ React + Vite Dashboard      |

## 🚀 快速开始

### 安装

```bash
# Clone the repository
git clone https://github.com/your-org/nanobot-ts.git
cd nanobot-ts

# Install dependencies (需要先安装 Bun: https://bun.sh)
bun install

# Build the project
bun run build
```

### 初始化

```bash
# 首次运行引导配置
pnpm run start
```

这将创建：

- `~/.nanobot/config.json` - 配置文件
- `~/.nanobot/workspace/` - 工作区目录
- 工作区中的模板文件

### 配置

编辑 `~/.nanobot/config.json`:

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

对于 MCP 配置，创建 `~/.nanobot/workspace/mcp.json`:

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

### 运行

```bash
# 启动网关及 TUI（终端用户界面）
nanobot-ts

# 启动网关及终端命令
nanobot-ts gateway

# 单条消息
nanobot-ts chat "Hello!"

# 交互模式（基于 CLI）
nanobot-ts chat --interactive
```

### TUI 模式

`nanobot` 命令现在包含一个由 opentui 驱动的现代化终端用户界面（TUI）：

**特性**：

- 🎨 **美观界面**: 响应式设计的现代化 TUI
- 💬 **聊天界面**: 实时聊天，支持消息历史
- 🎯 **斜杠命令**: 使用 `/` 前缀快速访问命令
- 🔍 **命令搜索**: 在 `/` 后输入文本以过滤命令
- 📜 **消息历史**: 自动从会话存储加载历史
- ⚙️ **配置管理**: 内置配置和设置管理
- 🎨 **主题支持**: 可自定义主题

**斜杠命令**：

| 命令 | 描述 |
|---------|-------------|
| `/new` | 开启新会话（归档当前历史） |
| `/help` | 显示帮助信息 |
| `/status` | 查看系统状态和会话 |
| `/models` | 配置 AI 模型 |
| `/themes` | 切换 UI 主题 |
| `/sessions` | 管理聊天会话 |
| `/init` | 初始化配置 |
| `/mcps` | 管理 MCP 服务器 |
| `/review` | 查看对话历史 |
| `/skills` | 管理技能 |

**使用方法**：

1. 在聊天输入框中输入 `/` 查看所有可用命令
2. 输入 `/` 后跟文本进行搜索（例如：`/stat` 查找 `/status`）
3. 使用方向键导航，回车键选择
4. 按 Esc 键关闭命令弹窗

## 💻 CLI 命令

| 命令                                                 | 描述                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `nanobot-ts init`                                       | 在 `~/.nanobot` 初始化配置和工作区，使用 `-f/--force` 覆盖 |
| `nanobot-ts chat [prompt]`                              | 发送提示并获取回复；添加 `-i/--interactive` 进入交互模式   |
| `nanobot-ts gateway`                                    | 启动消息总线和 Agent（默认端口：`--port 18790`）           |
| `nanobot-ts status`                                     | 查看配置和运行状态                                         |
| `nanobot-ts session`                                    | 列出所有会话                                               |
| `nanobot-ts config [key] [value]`                       | 查看或设置配置（例如：`agents.defaults.model`）            |
| `nanobot-ts channels status`                            | 检查渠道状态                                               |
| `nanobot-ts logs`                                       | 查看日志，使用 `-t/--tail <n>`（默认 50）                  |
| `nanobot-ts whatsapp:auth`                              | WhatsApp 二维码 / 配对码登录                               |
| `nanobot-ts whatsapp:status`                            | 检查 WhatsApp 登录状态                                     |
| `nanobot-ts whatsapp:logout`                            | 清除 WhatsApp 凭据                                         |
| `nanobot-ts mcp:list`                                   | 列出已连接的 MCP 服务器和工具                              |

### 示例

```bash
# 初始化或重新初始化
nanobot-ts init
nanobot-ts init --force

# 与 AI 对话
nanobot-ts chat "Help me write a Python function"
nanobot-ts chat -i

# 使用自定义端口启动网关
nanobot-ts gateway --port 8080

# 检查状态
nanobot-ts status
nanobot-ts channels status

# 查看日志
nanobot-ts logs
nanobot-ts logs --tail 100

# 配置模型
nanobot-ts config get
nanobot-ts config set agents.defaults.model openai:gpt-4o

# WhatsApp 认证
nanobot-ts whatsapp:auth
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789
nanobot-ts whatsapp:status
nanobot-ts whatsapp:logout

# MCP 操作
nanobot-ts mcp:list

```

### WhatsApp 认证

```bash
# 使用二维码认证（默认）
nanobot-ts whatsapp:auth

# 使用配对码认证
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789

# 强制重新认证
nanobot-ts whatsapp:auth --force

# 检查认证状态
nanobot-ts whatsapp:status

# 清除认证（登出）
nanobot-ts whatsapp:logout
```

## 📦 架构

nanobot-ts 采用以消息总线为核心的事件驱动架构：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户层（渠道）                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │   CLI      │  │ WhatsApp   │  │  飞书      │  │   邮箱    │        │
│  │  Channel   │  │  Channel   │  │  Channel   │  │  Channel   │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
└────────┼────────────────┼────────────────┼────────────────┼────────────────┘
         │                │                │                │
         ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         消息总线（队列系统）                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  • 入站队列：用户 → Agent                                                │
│  • 出站队列：Agent → 用户                                                │
│  • 审批过滤器：拦截 yes/no 回复                                         │
└─────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Loop（处理层）                              │
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
│  │ • 文件工具   │  │ • 基于风险   │  │ • 定时任务   │  │ • stdio      │ │
│  │ • Shell      │  │ • 记忆       │  │ • 持久化     │  │   服务器    │ │
│  │ • Web        │  │ • 每工具覆盖 │  │ • 一次性     │  │ • HTTP       │ │
│  │ • 消息       │  │              │  │ • 循环执行   │  │   服务器    │ │
│  │ • 后台任务    │  │              │  │ • 存储       │  │              │ │
│  │ • MCP 工具   │  │              │  │              │  │              │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    TUI       │  │   Slash      │  │  消息历史    │  │   主题       │ │
│  │   系统       │  │   命令       │  │              │  │   管理       │ │
│  │              │  │              │  │              │  │              │ │
│  │ • opentui    │  │ • /new       │  │ • 会话加载   │  │ • 颜色       │ │
│  │ • React      │  │ • /help      │  │ • 历史持久化 │  │ • 样式       │ │
│  │ • 布局       │  │ • /status    │  │ • 滚动查看   │  │ • 动态配置   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────┬───────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM Provider (Vercel AI SDK)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │   OpenAI   │  │ Anthropic  │  │ OpenRouter │  │   DeepSeek │         │
│  │   (GPT-4)  │  │  (Claude)  │  │ (所有模型) │  │  (DeepSeek) │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心组件

1. **消息总线**: 带有入站/出站队列的中心发布/订阅系统
2. **Agent Loop**: 主处理引擎，处理 LLM 交互和工具执行
3. **工具注册表**: 管理内置工具并动态加载 MCP 工具
4. **审批管理器**: 基于风险的工具审批，支持渠道特定处理器
5. **会话管理器**: 管理对话状态和历史记录
6. **记忆整合器**: 自动会话摘要和长期记忆
7. **渠道管理器**: 支持多渠道的统一接口
8. **定时任务服务**: 定时任务执行和持久化存储
9. **TUI 系统**: 现代化终端界面，支持斜杠命令

### 工具执行流程

```
LLM 决策 → 工具注册表 → 审批检查 → 执行 → 返回结果
                                      ↓
                                用户审批
                                      ↓
                           （通过 CLI/WhatsApp/飞书/邮箱）
```

详细的架构图和流程，请参阅：

- [Gateway 流程文档](docs/GATEWAY_FLOW.md)
- [Mermaid 图表](docs/GATEWAY_MERMAID.md)

## 🔌 渠道

### WhatsApp

- **库**: `baileys`
- **特性**: 二维码登录、配对码登录、消息处理、媒体支持

**认证**:

```bash
# 二维码登录（默认）
nanobot-ts whatsapp:auth

# 配对码登录
nanobot-ts whatsapp:auth --pairing-code --phone 86123456789

# 强制重新认证
nanobot-ts whatsapp:auth --force

# 检查认证状态
nanobot-ts whatsapp:status

# 清除认证（登出）
nanobot-ts whatsapp:logout
```

**认证流程**:

1. 运行 `nanobot-ts whatsapp:auth`
2. 使用手机上的 WhatsApp 扫描二维码
   - 打开 WhatsApp → 设置 → 关联设备 → 关联新设备
   - 或使用配对码模式
3. 凭据保存到 `~/.nanobot/whatsapp_auth/`
4. 在配置中启用 WhatsApp 并启动网关

**超时处理**:

- **自动重试**: 超时最多自动重试 5 次
- **指数退避**: 3秒、6秒、9秒、12秒、15秒的延迟
- **重试信息**: 显示当前重试次数和延迟

```bash
# 示例重试输出
⚠️  二维码已超时，3 秒后重试 (1/5)...
```

**建议**: 使用配对码模式以获得更好的超时处理（有效期更长）。

**配置**:

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

### 飞书

- **库**: `@larksuiteoapi/node-sdk`
- **特性**: WebSocket 长连接接收消息，API 发送消息；无需公网 IP
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

### 邮箱

- **库**: `imapflow` + `nodemailer`
- **特性**: IMAP 轮询，SMTP 发送

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

## 🤖 LLM 提供商

支持的提供商（基于 Vercel AI SDK）：

- ✅ OpenAI (GPT-4, GPT-4o, GPT-3.5)
- ✅ Anthropic (Claude 3.5, Claude 3, Claude Opus)
- ✅ OpenRouter（访问所有模型）
- ✅ Google (Gemini 1.5)
- ✅ DeepSeek
- ✅ Groq
- ✅ 以及更多...

## 🛠️ 工具

### 内置工具

| 工具          | 描述                         |
| ------------- | ---------------------------- |
| `read_file`   | 读取文件内容                 |
| `write_file`  | 写入文件                     |
| `edit_file`   | 编辑文件中的特定行           |
| `delete_file` | 删除文件                     |
| `list_dir`    | 列出目录内容                 |
| `exec`        | 执行 Shell 命令              |
| `web_search`  | 搜索网页（Brave Search API） |
| `web_fetch`   | 获取网页内容                 |
| `message`     | 向指定渠道发送消息           |
| `spawn`       | 生成后台子 Agent             |
| `cron`        | 定时任务管理，支持持久化存储 |

### MCP 工具

连接外部 MCP（模型上下文协议）服务器以扩展 nanobot-ts 的能力：

- ✅ 支持本地（STDIO）和远程（HTTP）服务器
- ✅ 受保护端点的 OAuth 认证
- ✅ 自动工具加载和注册
- ✅ 详见 [MCP.md](MCP.md) 配置详情

### 工具审批系统

基于风险等级的工具执行审批系统：

- **高风险**: 始终需要审批
- **中风险**: 检查审批记忆（可配置超时）
- **低风险**: 无需审批
- **每工具覆盖**: 每个工具可覆盖风险等级
- **严格模式**: 所有非低风险工具都需要审批
- **渠道特定处理器**: CLI、WhatsApp、飞书、邮箱

配置示例：

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

## 🎨 开发

```bash
# 开发模式（监听 CLI）
bun dev

# 构建所有包
bun build

# 构建 CLI 二进制文件
bun run build:binary

# 运行测试
bun test

# 测试并生成覆盖率
bun test:coverage

# 测试监听模式
bun test:watch

# 代码检查
bun lint

# 代码检查并自动修复
bun lint:fix

# 格式化代码
bun format

# 类型检查
bun typecheck

# 清理构建产物
bun clean

# 快速开始命令
bun onboard           # 初始化配置
bun agent             # 交互式聊天模式
bun gateway           # 启动 Gateway
bun status            # 查看状态
```

**特定包开发**：

```bash
# 开发特定包（从根目录）
cd packages/main && bun run typecheck
cd packages/cli && bun run build
cd packages/tui && bun run dev
cd packages/web && bun run dev
```

## 📊 项目结构

nanobot-ts 使用 Bun workspaces 组织为 monorepo：

```
nanobot-ts/
├── packages/               # Monorepo 包
│   ├── main/               # 核心框架（Agent、Memory、Tools、Skills、MCP）
│   │   ├── src/
│   │   │   ├── core/       # 核心 Agent 逻辑
│   │   │   ├── bus/        # 消息总线实现
│   │   │   ├── tools/      # 内置工具
│   │   │   ├── storage/    # 存储层
│   │   │   ├── skills/     # 技能系统
│   │   │   ├── cron/       # 定时任务服务
│   │   │   └── mcp/        # MCP 集成
│   ├── cli/                # CLI 工具和命令
│   │   └── src/
│   │       ├── commands/   # CLI 命令处理器
│   │       └── whatsapp-auth.ts
│   ├── tui/                # 终端用户界面（opentui）
│   │   └── src/
│   │       ├── components/ # TUI React 组件
│   │       ├── commands/   # 斜杠命令处理器
│   │       ├── hooks/      # 自定义 React hooks
│   │       ├── gateway/    # Gateway UI
│   │       └── home/       # 首页
│   ├── channels/           # 消息渠道
│   │   └── src/
│   │       ├── base.ts     # 基础渠道接口
│   │       ├── cli.ts      # CLI 渠道
│   │       ├── whatsapp.ts # WhatsApp 渠道
│   │       ├── feishu.ts   # 飞书渠道
│   │       └── email.ts    # Email 渠道
│   ├── providers/          # LLM 提供商
│   │   └── src/
│   │       ├── adapters/   # 提供商适配器
│   │       └── registry.ts # 提供商注册表
│   ├── server/             # HTTP 服务器
│   │   └── src/
│   │       ├── routes/     # API 路由
│   │       └── middleware/ # 服务器中间件
│   ├── web/                # Web Dashboard（React + Vite）
│   │   └── src/
│   │       ├── components/ # Web UI 组件
│   │       └── lib/        # 工具函数
│   ├── shared/             # 共享类型和配置
│   │   └── src/
│   │       ├── config/     # 配置 schemas 和默认值
│   │       └── loader.ts   # 配置加载器
│   ├── logger/             # 日志工具
│   │   └── src/
│   │       └── logger.ts   # Logger 实现
│   ├── utils/              # 工具函数
│   │   └── src/
│   │       ├── errors.ts   # 错误处理
│   │       ├── helpers.ts  # 辅助函数
│   │       └── retry.ts    # 重试逻辑
│   └── workspace/          # 工作区模板和示例
│       ├── AGENTS.md       # Agent 配置指南
│       ├── TOOLS.md        # 工具配置指南
│       ├── skills/         # 示例技能
│       └── memory/         # 记忆存储
├── tests/                  # 测试文件
├── docs/                   # 文档
├── package.json            # 根包（monorepo 配置）
└── bun.lock                # 锁文件
```

## 🏗️ Monorepo 架构

nanobot-ts 使用 Bun workspaces 组织为 monorepo，以实现更好的代码组织和模块化。

### 核心包

| 包名 | 描述 | 主要功能 |
|-----|------|---------|
| `@nanobot/main` | 核心框架 | Agent 循环、记忆、工具、技能、MCP、定时任务、审批 |
| `@nanobot/cli` | CLI 工具 | 命令解析、入口点、WhatsApp 认证 |
| `@nanobot/tui` | 终端 UI | 基于 opentui 的界面、斜杠命令 |
| `@nanobot/channels` | 消息渠道 | WhatsApp、飞书、邮箱、CLI |
| `@nanobot/providers` | LLM 提供商 | OpenAI、Anthropic、OpenRouter 等 |
| `@nanobot/server` | HTTP 服务器 | REST API、Web 服务器中间件 |
| `web` | Web Dashboard | React + Vite 前端（独立） |
| `@nanobot/shared` | 共享类型 | 配置 schemas、类型、默认值 |
| `@nanobot/logger` | 日志工具 | 控制台和文件日志 |
| `@nanobot/utils` | 工具函数 | 辅助函数、重试逻辑、错误处理 |

### 构建和发布

所有包都使用 Bun 构建：

```bash
# 构建所有包
bun build

# 构建特定包
cd packages/cli && bun run build

# 类型检查特定包
cd packages/main && bun run typecheck
```

### Workspace 优势

- **模块化**: 清晰的职责分离
- **可维护性**: 更容易定位和修复问题
- **可重用性**: 包可以独立使用
- **测试**: 每个包可以独立测试
- **性能**: 只构建修改的部分

### 添加新包

1. 创建包目录: `packages/new-package/`
2. 添加包含正确导出的 `package.json`
3. 如需要添加 TypeScript 配置
4. 更新根 `package.json` workspaces（可选，自动发现）
5. 使用包名导入: `@nanobot/new-package`

### 从单仓库迁移

项目已从单个 `src/` 目录迁移到 monorepo 结构。详见 [MIGRATION.md](MIGRATION.md)。

## 📚 文档

### 架构与设计
- [Gateway 流程文档](docs/GATEWAY_FLOW.md) - 详细的消息流程图
- [Mermaid 图表](docs/GATEWAY_MERMAID.md) - 可视化架构图
- [多 Agent 架构](docs/MULIT-AGEBTS-ARCH.md) - 多 Agent 系统设计

### 配置与设置
- [飞书渠道指南](docs/FEISHU.md) - 飞书渠道配置
- [MCP 配置](docs/MCP.md) - 模型上下文协议设置
- [部署指南](docs/DEPLOYMENT.md) - 生产环境部署说明
- [Monorepo 迁移](MIGRATION.md) - 从单仓库迁移到 monorepo

### 功能
- [定时任务服务](packages/main/src/cron/README.md) - 定时任务执行系统
- [TUI 斜杠命令](packages/tui/src/commands/README.md) - 终端用户界面命令系统
- [Subagent 实现](docs/subagent-implementation.md) - 后台任务处理架构
- [Subagent 使用指南](docs/subagent-usage.md) - 配置和使用示例
- [技能系统](docs/SKILL-SYSTEM.md) - 基于技能的架构
- [审批流程](docs/APPROVAL-FLOW.md) - 基于风险的工具审批系统

### 开发
- [API 文档](docs/API.md) - API 参考
- [Agent 模式](docs/AGENT-PATTERNS.md) - 常见的 Agent 模式
- [浏览器自动化](docs/browser-automation-plan.md) - 使用 agent-browser 进行浏览器自动化

### 迁移与升级
- [Bun 迁移](docs/BUN_MIGRATION.md) - 迁移到 Bun 运行时
- [TUI 迁移](docs/TUI_MIGRATION.md) - 终端 UI 迁移

## 📄 许可证

MIT

## 🙏 致谢

- Python 原始版本: [HKUDS/nanobot](https://github.com/HKUDS/nanobot)
- AI SDK: [Vercel AI SDK](https://sdk.vercel.ai/)
- 测试框架: [Vitest](https://vitest.dev/)
