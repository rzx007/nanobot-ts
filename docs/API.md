# Nanobot TypeScript API 文档

## 目录

- [核心 API](#核心-api)
  - [Agent Loop](#agent-loop)
  - [Message Bus](#message-bus)
  - [Tool Registry](#tool-registry)
  - [渠道 API](#渠道-api)
  - [Base Channel](#base-channel)
  - [WhatsApp Channel](#whatsapp-channel)
  - [Feishu Channel](#feishu-channel)
  - [Email Channel](#email-channel)
  - [Provider API](#provider-api)
  - [工具 API](#工具-api)
  - [配置 API](#配置-api)

---

## 核心 API

### Agent Loop

主处理循环，驱动 AI 对话。

#### 构造函数

```typescript
interface AgentLoopOptions {
  bus: MessageBus;
  provider: LLMProvider;
  workspace: string;
  model?: string;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  memoryWindow?: number;
  braveApiKey?: string;
  execConfig?: ExecConfig;
  restrictToWorkspace?: boolean;
  sessionManager?: SessionManager;
}

class AgentLoop {
  constructor(options: AgentLoopOptions);
}
```

#### 方法

##### `run()`

启动主循环，持续处理消息。

```typescript
async run(): Promise<void>;
```

**示例**:

```typescript
const agent = new AgentLoop({
  bus: messageBus,
  provider: llmProvider,
  workspace: '~/.nanobot/workspace',
});

await agent.run(); // 持续运行
```

##### `stop()`

停止主循环。

```typescript
stop(): void;
```

##### `process()`

处理单个消息（用于 CLI 模式）。

```typescript
async process(
  msg: InboundMessage,
  sessionKey?: string,
  onProgress?: (content: string, options?: { toolHint?: boolean }) => Promise<void>
): Promise<OutboundMessage | null>;
```

**参数**:

- `msg`: 入站消息
- `sessionKey`: 可选的会话密钥
- `onProgress`: 进度回调函数

**返回**: 出站消息或 null

---

### Message Bus

异步消息队列系统，解耦渠道和 Agent。

#### 构造函数

```typescript
class MessageBus extends EventEmitter {
  constructor();
}
```

#### 方法

##### `publishInbound()`

发布入站消息。

```typescript
async publishInbound(msg: InboundMessage): Promise<void>;
```

##### `consumeInbound()`

消费入站消息（阻塞直到有消息）。

```typescript
async consumeInbound(): Promise<InboundMessage>;
```

##### `publishOutbound()`

发布出站消息。

```typescript
async publishOutbound(msg: OutboundMessage): Promise<void>;
```

##### `consumeOutbound()`

消费出站消息。

```typescript
async consumeOutbound(): Promise<OutboundMessage>;
```

---

### Tool Registry

工具注册和执行框架。

#### 构造函数

```typescript
class ToolRegistry {
  constructor();
}
```

#### 方法

##### `register()`

注册工具。

```typescript
register(tool: Tool): void;
```

##### `unregister()`

注销工具。

```typescript
unregister(name: string): void;
```

##### `get()`

获取工具。

```typescript
get(name: string): Tool | undefined;
```

##### `execute()`

执行工具。

```typescript
async execute(name: string, params: Record<string, unknown>): Promise<string>;
```

##### `getDefinitions()`

获取所有工具定义（OpenAI 格式）。

```typescript
getDefinitions(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}>;
```

---

## 渠道 API

### Base Channel

所有渠道的基类。

```typescript
abstract class BaseChannel {
  constructor(
    protected config: ChannelConfig,
    protected bus: MessageBus
  );

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(msg: OutboundMessage): Promise<void>;
}
```

### WhatsApp Channel

WhatsApp 渠道实现（使用 Baileys）。

#### 配置

```typescript
interface WhatsAppConfig {
  enabled: boolean;
  allowFrom: string[];
}
```

#### 特性

- ✅ 二维码登录
- ✅ 消息接收/发送
- ✅ 媒体文件支持
- ✅ 群聊和私聊

### Feishu Channel

Feishu/Lark 渠道实现（使用 @larksuiteoapi/node-sdk）。

#### 配置

```typescript
interface FeishuConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
  encryptKey: string;
  verificationToken: string;
  allowFrom: string[];
}
```

#### 特性

- ✅ WebSocket 长连接
- ✅ 消息接收/发送
- ✅ 官方 SDK

### Email Channel

Email 渠道实现（使用 imapflow + nodemailer）。

#### 配置

```typescript
interface EmailConfig {
  enabled: boolean;
  consentGranted: boolean;
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapMailbox: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  fromAddress: string;
  allowFrom: string[];
  autoReplyEnabled: boolean;
}
```

#### 特性

- ✅ IMAP 轮询接收
- ✅ SMTP 发送
- ✅ 附件支持
- ✅ 自动回复

---

## Provider API

### LLM Provider

LLM 提供商接口（基于 Vercel AI SDK）。

```typescript
interface LLMProvider {
  chat(params: {
    messages: Array<{ role: string; content: string }>;
    tools: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    hasToolCalls: boolean;
    toolCalls: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }>;
}
```

#### 使用示例

```typescript
import { createOpenAI, openai } from '@ai-sdk/openai';

const provider = createOpenAI({
  apiKey: config.apiKey,
  baseURL: config.apiBase,
});

const result = await provider.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  tools: toolDefinitions,
  model: 'gpt-4o',
  temperature: 0.1,
});
```

---

## 工具 API

### Tool

工具基类。

```typescript
abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, unknown>;
  abstract execute(params: Record<string, unknown>): Promise<string>;

  toSchema(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
}
```

### 内置工具

#### ReadFileTool

```typescript
class ReadFileTool extends Tool {
  name = 'read_file';

  description = 'Read contents of a file';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file',
      },
    },
    required: ['path'],
  };

  async execute(params: { path: string }): Promise<string> {
    // ...
  }
}
```

#### WriteFileTool

```typescript
class WriteFileTool extends Tool {
  name = 'write_file';

  description = 'Write content to a file';

  parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file',
      },
      content: {
        type: 'string',
        description: 'Content to write',
      },
    },
    required: ['path', 'content'],
  };

  async execute(params: { path: string; content: string }): Promise<string> {
    // ...
  }
}
```

#### ExecTool

```typescript
class ExecTool extends Tool {
  name = 'exec';

  description = 'Execute a shell command';

  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
    },
    required: ['command'],
  };

  async execute(params: { command: string }): Promise<string> {
    // ...
  }
}
```

---

## 配置 API

### Config

配置 Schema（使用 Zod 验证）。

```typescript
interface Config {
  agents: {
    defaults: {
      workspace: string;
      model: string;
      temperature: number;
      maxTokens: number;
      maxIterations: number;
      memoryWindow: number;
    };
  };
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    openrouter: ProviderConfig;
    // ...
  };
  channels: {
    whatsapp: WhatsAppConfig;
    feishu: FeishuConfig;
    email: EmailConfig;
  };
  tools: {
    restrictToWorkspace: boolean;
    exec: {
      timeout: number;
      allowedCommands: string[];
    };
    web: {
      search: {
        apiKey?: string;
      };
    };
  };
}
```

### 配置文件加载

```typescript
import { cosmiconfig } from 'cosmiconfig';

const { config } = await cosmiconfig('nanobot', {
  searchPlaces: [
    '~/.nanobot/config.json',
    './config.json',
  ],
});

// 配置会自动使用 Zod 验证
```

---

## 事件类型

### InboundMessage

```typescript
interface InboundMessage {
  channel: string;  // whatsapp, feishu, email, cli
  senderId: string;
  chatId: string;
  content: string;
  timestamp: Date;
  media?: string[];  // 文件路径或 URL
  metadata?: Record<string, unknown>;
  sessionKeyOverride?: string;

  readonly sessionKey: string;
}
```

### OutboundMessage

```typescript
interface OutboundMessage {
  channel: string;
  chatId: string;
  content: string;
  replyTo?: string;
  media?: string[];
  metadata?: Record<string, unknown>;
}
```

---

## 错误处理

### 错误类型

```typescript
class NanobotError extends Error {
  code: string;
  context?: Record<string, unknown>;
}

class ConfigError extends NanobotError {
  code = 'CONFIG_ERROR';
}

class ProviderError extends NanobotError {
  code = 'PROVIDER_ERROR';
}

class ToolError extends NanobotError {
  code = 'TOOL_ERROR';
}

class ChannelError extends NanobotError {
  code = 'CHANNEL_ERROR';
}
```

---

## 使用示例

### 基础使用

```typescript
import { AgentLoop } from './core/agent';
import { MessageBus } from './bus/queue';
import { createOpenAI } from '@ai-sdk/openai';

// 创建消息总线
const bus = new MessageBus();

// 创建 LLM Provider
const provider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 创建 Agent
const agent = new AgentLoop({
  bus,
  provider,
  workspace: '~/.nanobot/workspace',
});

// 启动
await agent.run();
```

### 自定义工具

```typescript
import { Tool } from './tools/base';

class CustomTool extends Tool {
  name = 'custom_tool';

  description = 'This is a custom tool';

  parameters = {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: 'Input value',
      },
    },
    required: ['input'],
  };

  async execute(params: { input: string }): Promise<string> {
    return `Processed: ${params.input}`;
  }
}

// 注册工具
toolRegistry.register(new CustomTool());
```

### 自定义渠道

```typescript
import { BaseChannel } from './channels/base';
import type { InboundMessage, OutboundMessage } from '../bus/events';

class CustomChannel extends BaseChannel {
  async start(): Promise<void> {
    // 连接到平台
  }

  async stop(): Promise<void> {
    // 断开连接
  }

  async send(msg: OutboundMessage): Promise<void> {
    // 发送消息
  }

  private async handleMessage(msg: InboundMessage): Promise<void> {
    await this.bus.publishInbound(msg);
  }
}
```



区别可以这样理解：

---

## Gateway 方式（`nanobot gateway`）

- **常驻进程**：启动后一直运行，Agent 在后台 `agent.run()`，不断从 bus 取入站消息并处理。
- **走 ChannelManager**：有出站循环 `runOutboundLoop()`，消费 `bus.consumeOutbound()`，按 `msg.channel` 分发给各渠道的 `send()`（例如 CLI 渠道就打印）。
- **异步、多轮**：你输入后只做 `bus.publishInbound()`，然后立刻又能输入下一句；回复由出站循环异步取到后，由对应渠道打印出来。
- **用途**：为「多轮对话 + 多渠道」准备的网关形态，以后可以在同一进程里加 HTTP、飞书等渠道，所有入站/出站都经 bus 和 ChannelManager。

---

## Chat 方式（`nanobot chat [prompt]` / `nanobot chat -i`）

- **按次调用**：不启动常驻的 `agent.run()`，每次对话都是直接调 **`agent.process(msg)` 一次**，同步等待这条消息处理完并拿到 `out`。
- **不经过 ChannelManager**：没有出站队列、没有渠道分发，结果由命令里直接 `console.log(out.content)`。
- **两种用法**：
  - **单条**：`nanobot chat "你好"` → 发一条 → 等这一条跑完 → 打印 → 进程退出。
  - **交互**：`nanobot chat -i` → readline 循环，每次输入 → `agent.process(msg)` → 等这条结束 → 打印 → 再问下一句。
- **用途**：一次性或简单多轮对话，脚本/命令行里「发一句拿一句」最方便。

---

## 对比小结

| 维度         | Gateway                    | Chat                          |
|--------------|----------------------------|-------------------------------|
| 进程         | 常驻                       | 单次或简单交互循环后退出       |
| 消息路径     | Bus → Agent → Bus → ChannelManager → 各渠道 `send()` | 直接 `agent.process()` → 返回值 |
| 回复方式     | 异步，由渠道打印           | 同步，命令里直接打印          |
| 多渠道扩展   | 是（同一 bus + 多渠道）    | 否，仅当前 CLI 输出           |

简单记：**Gateway = 常驻网关 + 总线 + 渠道分发**；**Chat = 按次调用 Agent，同步拿回复**。