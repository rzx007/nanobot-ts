# Nanobot TypeScript 版本 - 开发者计划文档

## 1. 项目设置

### 1.1 环境要求

```bash
# 必需
- Node.js >= 18.0.0 (推荐 20.x LTS)
- pnpm >= 8.0.0 或 npm >= 9.0.0
- TypeScript >= 5.3.0

# 可选
- Docker (用于容器化部署)
- Make (自动化脚本)
```

### 1.2 本地开发环境

```bash
# 1. Clone 仓库
git clone https://github.com/your-org/nanobot-ts.git
cd nanobot-ts

# 2. 安装依赖 (推荐 pnpm)
pnpm install

# 3. 初始化配置
pnpm run onboard

# 4. 开发模式 (自动重启)
pnpm run dev

# 5. 构建生产版本
pnpm run build

# 6. 运行测试
pnpm test

# 7. 查看测试覆盖率
pnpm test:coverage
```

### 1.3 项目结构

```bash
nanobot-ts/
├── src/
│   ├── core/                    # 核心模块
│   │   ├── agent.ts            # Agent 主循环
│   │   ├── context.ts          # 提示词构建
│   │   ├── memory.ts           # 会话记忆
│   │   ├── skills.ts           # 技能加载器
│   │   └── index.ts
│   │
│   ├── bus/                     # 消息总线
│   │   ├── queue.ts            # 消息队列
│   │   ├── events.ts           # 类型定义
│   │   └── index.ts
│   │
│   ├── channels/                # 渠道实现
│   │   ├── base.ts             # BaseChannel 抽象类
│   │   ├── whatsapp.ts         # WhatsApp (Baileys)
│   │   ├── feishu.ts          # Feishu (lark-oapi)
│   │   ├── email.ts            # Email (imapflow + nodemailer)
│   │   ├── cli.ts             # CLI 渠道
│   │   ├── manager.ts         # 渠道管理器
│   │   └── index.ts
│   │
│   ├── tools/                   # 工具系统
│   │   ├── base.ts             # Tool 抽象类
│   │   ├── registry.ts         # ToolRegistry
│   │   ├── filesystem.ts       # 文件操作
│   │   ├── shell.ts            # Shell 执行
│   │   ├── web.ts              # 网络相关
│   │   ├── message.ts          # 消息发送
│   │   ├── cron.ts            # 定时任务
│   │   └── index.ts
│   │
│   ├── providers/               # LLM 提供商
│   │   ├── registry.ts         # 提供商注册表
│   │   └── index.ts
│   │
│   ├── config/                  # 配置管理
│   │   ├── schema.ts           # 配置 Schema (Zod)
│   │   ├── loader.ts           # 配置文件加载
│   │   └── index.ts
│   │
│   ├── storage/                 # 存储层
│   │   ├── session.ts          # 会话存储
│   │   └── index.ts
│   │
│   ├── cli/                     # CLI 命令
│   │   ├── index.ts            # 命令入口
│   │   ├── commands/           # 具体命令
│   │   │   ├── agent.ts
│   │   │   ├── gateway.ts
│   │   │   ├── config.ts
│   │   │   └── channels.ts
│   │   └── ui.ts              # 终端 UI (ora, inquirer)
│   │
│   ├── utils/                   # 工具函数
│   │   ├── logger.ts           # Pino 日志
│   │   ├── errors.ts           # 自定义错误
│   │   └── helpers.ts          # 辅助函数
│   │
│   └── index.ts                 # 导出主入口
│
├── templates/                  # 模板文件
│   ├── workspace/             # 工作区模板
│   │   ├── AGENTS.md
│   │   ├── SOUL.md
│   │   ├── USER.md
│   │   ├── TOOLS.md
│   │   └── memory/
│   │       └── MEMORY.md
│   │   └── HISTORY.md
│   └── skills/               # 内置技能
│       ├── weather/
│       │   └── SKILL.md
│       ├── github/
│       │   └── SKILL.md
│       └── memory/
│           └── SKILL.md
│
├── tests/
│   ├── unit/                    # 单元测试
│   │   ├── core/
│   │   ├── bus/
│   │   ├── tools/
│   │   └── providers/
│   ├── integration/             # 集成测试
│   │   ├── agent.test.ts
│   │   └── channels.test.ts
│   └── fixtures/                # 测试数据
│       ├── messages.ts
│       └── configs.ts
│
├── docs/                        # 文档
│   ├── PRD.md                  # 产品需求
│   ├── DEVELOPER_PLAN.md       # 本文件
│   ├── API.md                  # API 文档
│   └── ARCHITECTURE.md         # 架构详解
│
├── .eslintrc.cjs                # ESLint 配置
├── .prettierrc.json            # Prettier 配置
├── vitest.config.ts             # Vitest 配置
├── tsconfig.json               # TypeScript 配置
├── tsup.config.ts              # 打包配置 (tsup)
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 2. 依赖库选择

### 2.1 核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `@ai-sdk/openai` | latest | OpenAI Provider |
| `@ai-sdk/anthropic` | latest | Anthropic/Claude Provider |
| `@ai-sdk/google` | latest | Gemini Provider |
| `zod` | latest | 配置 Schema 验证 |
| `cosmiconfig` | latest | 配置文件加载 |
| `commander` | latest | CLI 框架 |
| `pino` | latest | 日志系统 |
| `pino-pretty` | latest | 开发环境日志美化 |
| `eventemitter3` | latest | Message Bus |
| `async-queue` | latest | 异步队列 |
| `undici` | latest | HTTP 客户端 |

### 2.2 渠道依赖

| 渠道 | 包名 | 用途 |
|------|------|------|
| **WhatsApp** | `baileys` | WhatsApp Web API |
| **Feishu** | `@larksuiteoapi/node-sdk` | 官方 Feishu SDK |
| **Email** | `imapflow` | IMAP 客户端 |
| | `nodemailer` | SMTP 客户端 |

### 2.3 工具依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `fs-extra` | latest | 文件系统操作 |
| `execa` | latest | Shell 命令执行 |
| `cheerio` | latest | HTML 解析 (web_fetch) |
| `markdown-it` | latest | Markdown 渲染 |

### 2.4 开发依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | latest | TypeScript 编译器 |
| `vitest` | latest | 测试框架 |
| `@vitest/ui` | latest | 测试 UI |
| `@vitest/coverage-v8` | latest | 代码覆盖率 |
| `@types/node` | latest | Node.js 类型 |
| `tsx` | latest | TypeScript 执行 |
| `eslint` | latest | 代码检查 |
| `@typescript-eslint/*` | latest | TypeScript ESLint 规则 |
| `prettier` | latest | 代码格式化 |
| `tsup` | latest | 打包工具 |
| `ora` | latest | 命令行 Spinner |
| `inquirer` | latest | 命令行交互 |
| `chalk` | latest | 命令行颜色 |

---

## 3. 编码规范

### 3.1 TypeScript 规范

#### 命名规范

```typescript
// ✅ 类: PascalCase
class AgentLoop { }
class MessageBus { }
class ToolRegistry { }

// ✅ 接口: PascalCase
interface InboundMessage { }
interface AgentConfig { }
interface Tool { }

// ✅ 类型别名: PascalCase
type MessageHandler = (msg: InboundMessage) => Promise<void>;
type ProviderName = 'openai' | 'anthropic' | 'openrouter';

// ✅ 函数: camelCase
async function processMessage() { }
function buildPrompt() { }
function validateConfig() { }

// ✅ 常量: UPPER_SNAKE_CASE
const MAX_ITERATIONS = 40;
const DEFAULT_TIMEOUT = 30000;
const CONFIG_PATH = '~/.nanobot/config.json';

// ✅ 私有属性: _camelCase 或 #private
class MyClass {
  private _privateField: string;
  #jsPrivate: string; // TS 3.8+ 私有字段
  public publicField: string;
}

// ✅ 枚举: PascalCase (值用 UPPER_SNAKE_CASE)
enum ChannelType {
  WHATSAPP = 'whatsapp',
  FEISHU = 'feishu',
  EMAIL = 'email',
}

// ✅ 对象属性: camelCase
interface Message {
  channelId: string;
  senderId: string;
  timestamp: Date;
}
```

#### 类型规范

```typescript
// ✅ 显式类型注解
function processMessage(msg: InboundMessage): Promise<OutboundMessage> {
  return { channel: msg.channel, content: '...' };
}

// ✅ 导出类型
export interface Config {
  agents: AgentConfig;
  providers: ProvidersConfig;
}

// ✅ 避免 any，使用 unknown
// ❌ function process(data: any) { }
// ✅ function process(data: unknown) {
    if (typeof data === 'string') {
      // ...
    }
  }

// ✅ 使用 Union Types 代替 optional 参数
// ❌ function send(msg: Message, retries?: number) { }
// ✅ function send(msg: Message, options: { retries?: number }) { }

// ✅ 使用 readonly 保护不可变数据
interface ReadonlyMessage {
  readonly id: string;
  readonly createdAt: Date;
  readonly content: string;
}

// ✅ 使用泛型提高复用性
interface Response<T> {
  data: T;
  error: Error | null;
}

// ✅ 使用类型谓词进行类型守卫
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// ✅ 使用 satisfies 操作符进行类型推断
const config = {
  name: 'nanobot',
  version: '1.0.0',
} satisfies Config;
```

#### 异步规范

```typescript
// ✅ 使用 async/await
async function main() {
  const result = await processMessage(msg);
  return result;
}

// ✅ Promise 泛型明确
function getData(): Promise<Data> {
  return fetch('/api/data').then(r => r.json());
}

// ✅ 错误处理 - 使用 Error 对象
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof NetworkError) {
    logger.error('Network error', { error: error.message });
  } else {
    throw new Error(`Failed: ${error}`, { cause: error });
  }
}

// ✅ 超时处理 - 使用 Promise.race
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ✅ 并发控制 - 使用 Promise.all / allSettled
async function processAll(items: Item[]): Promise<Result[]> {
  // 并发执行所有
  return Promise.all(items.map(item => processItem(item)));

  // 或者等待所有完成（即使失败）
  const results = await Promise.allSettled(items.map(item => processItem(item)));
  return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}
```

### 3.2 文件规范

```typescript
// ✅ 文件顶部的导入顺序
// 1. Node.js 内置模块
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import path from 'path';

// 2. 第三方库
import { z } from 'zod';
import pino from 'pino';

// 3. 内部模块 (使用相对路径)
import type { InboundMessage, OutboundMessage } from './events';
import { logger } from '../utils/logger';
import { ToolRegistry } from '../tools';

// ✅ 区分 import 和 type import
import { someClass } from './module';
import type { SomeType, SomeInterface } from './types';

// ✅ 导出顺序
export const MAX_ITERATIONS = 40;
export type MessageHandler = (msg: Message) => Promise<void>;
export interface Message { }
export abstract class BaseChannel { }
export function createMessage() { }
```

### 3.3 注释规范

```typescript
// ✅ JSDoc 注释 (用于公开 API)
/**
 * 处理消息并返回响应
 *
 * @param msg - 入站消息
 * @param options - 处理选项
 * @returns 出站消息或 null
 * @throws {ValidationError} 消息格式不正确
 *
 * @example
 * ```ts
 * const response = await agent.process(message);
 * await bus.publishOutbound(response);
 * ```
 */
async function process(
  msg: InboundMessage,
  options?: ProcessOptions,
): Promise<OutboundMessage | null> {
  // ...
}

// ✅ 行注释: 解释 "为什么" 不是 "是什么"
// 使用 Promise.race 而不是 setTimeout callback
// 以避免嵌套回调地狱和更好的错误处理
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, createTimeout(ms)]);
}

// ✅ 复杂逻辑的步骤注释
// 步骤1: 验证消息格式
validateMessage(msg);

// 步骤2: 检查用户权限
if (!isAuthorized(msg.senderId)) {
  throw new UnauthorizedError('User not authorized');
}

// 步骤3: 路由到对应的处理器
const handler = handlers[msg.channel];
await handler(msg);

// ❌ 避免冗余注释
// 这是一个常量
const MAX_RETRIES = 3;

// ❌ 避免无意义的注释
function foo() {
  // 定义变量
  const x = 1;
  // 返回变量
  return x;
}
```

### 3.4 代码示例

```typescript
// ✅ 完整的代码示例
import { EventEmitter } from 'events';
import type { InboundMessage, OutboundMessage } from './events';
import { logger } from '../utils/logger';

/**
 * 异步消息总线
 *
 * 用于解耦渠道和 Agent 处理
 */
export class MessageBus extends EventEmitter {
  private readonly inboundQueue: InboundMessage[] = [];
  private readonly outboundQueue: OutboundMessage[] = [];
  private readonly inboundConsumers: Array<(msg: InboundMessage) => void> = [];

  /**
   * 发布入站消息
   */
  async publishInbound(msg: InboundMessage): Promise<void> {
    this.inboundQueue.push(msg);
    this.emit('inbound', msg);
    logger.debug('Inbound message queued', {
      channel: msg.channel,
      sender: msg.senderId,
    });
  }

  /**
   * 消费入站消息 (阻塞直到有消息)
   */
  async consumeInbound(): Promise<InboundMessage> {
    // 队列中有消息，立即返回
    if (this.inboundQueue.length > 0) {
      const msg = this.inboundQueue.shift()!;
      return msg;
    }

    // 等待新消息
    return new Promise((resolve) => {
      this.inboundConsumers.push(resolve);
    });
  }
}
```

---

## 4. 测试指南

### 4.1 测试框架配置

使用 **Vitest** 作为测试框架。

```bash
# 安装
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      exclude: ['**/node_modules/**', '**/dist/**', '**/templates/**'],
    },
  },
});
```

### 4.2 测试结构

```typescript
// ✅ 测试文件命名: xxx.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus } from '../src/bus/queue';
import type { InboundMessage } from '../src/bus/events';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  afterEach(async () => {
    await bus.stop();
  });

  describe('publishInbound', () => {
    it('should add message to queue', async () => {
      const msg: InboundMessage = {
        channel: 'test',
        senderId: 'user1',
        chatId: '123',
        content: 'hello',
        timestamp: new Date(),
      };

      await bus.publishInbound(msg);
      const result = await bus.consumeInbound();

      expect(result).toEqual(msg);
    });

    it('should handle concurrent publishes', async () => {
      const msgs: InboundMessage[] = Array.from({ length: 10 }, (_, i) => ({
        channel: 'test',
        senderId: `user${i}`,
        chatId: `${i}`,
        content: `message ${i}`,
        timestamp: new Date(),
      }));

      await Promise.all(msgs.map((m) => bus.publishInbound(m)));

      for (const msg of msgs) {
        const result = await bus.consumeInbound();
        expect(result.senderId).toBe(msg.senderId);
      }
    });
  });
});
```

### 4.3 测试 Mock

```typescript
// ✅ 使用 vitest.fn() 创建 mock
import { vi } from 'vitest';

describe('AgentLoop', () => {
  it('should call provider.chat', async () => {
    const mockProvider = {
      chat: vi.fn().mockResolvedValue({
        content: 'Hello',
        hasToolCalls: false,
      }),
    };

    const agent = new AgentLoop({
      provider: mockProvider,
      // ...
    });

    await agent.process({
      channel: 'cli',
      senderId: 'user',
      chatId: 'direct',
      content: 'Hello',
    });

    expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    expect(mockProvider.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user' }),
      ]),
      expect.any(Array),
    );
  });
});
```

### 4.4 集成测试

```typescript
// ✅ 集成测试 - 测试完整流程
import { describe, it, expect } from 'vitest';
import { AgentLoop } from '../../src/core/agent';
import { MessageBus } from '../../src/bus/queue';
import { createTestProvider } from '../fixtures/providers';
import { createTestConfig } from '../fixtures/configs';

describe('Agent Integration', () => {
  it('should process message with tool calls', async () => {
    const bus = new MessageBus();
    const provider = createTestProvider();
    const config = createTestConfig();

    const agent = new AgentLoop({
      bus,
      provider,
      workspace: config.workspace,
    });

    const response = await agent.process({
      channel: 'cli',
      senderId: 'user',
      chatId: 'direct',
      content: 'List files in current directory',
    });

    expect(response?.content).toBeDefined();
    expect(provider.chat).toHaveBeenCalled();
  });
});
```

### 4.5 测试覆盖目标

| 模块               | 目标覆盖 | 优先级   |
|--------------------|----------|----------|
| 核心 (agent, bus)    | 90%      | 🔴 高    |
| 工具实现            | 80%      | 🟡 中    |
| 渠道实现            | 70%      | 🟢 低    |
| 配置和工具函数      | 80%      | 🟡 中    |
| LLM Provider        | 85%      | 🔴 高    |

### 4.6 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定文件
pnpm test agent.test.ts

# 监听模式 (开发时)
pnpm test:watch

# 覆盖率报告
pnpm test:coverage

# UI 模式
pnpm test:ui
```

---

## 5. 配置 Schema (Zod)

### 5.1 配置 Schema 定义

```typescript
import { z } from 'zod';

// Provider 配置
const ProviderConfigSchema = z.object({
  apiKey: z.string().min(1),
  apiBase: z.string().url().optional(),
  extraHeaders: z.record(z.string()).optional(),
});

// Agent 配置
const AgentDefaultsSchema = z.object({
  workspace: z.string().default('~/.nanobot/workspace'),
  model: z.string().default('openai:gpt-4o'),
  maxTokens: z.number().int().positive().default(8192),
  temperature: z.number().min(0).max(2).default(0.1),
  maxIterations: z.number().int().positive().default(40),
  memoryWindow: z.number().int().positive().default(100),
});

// 渠道配置
const WhatsAppConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowFrom: z.array(z.string()).default([]),
});

const FeishuConfigSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  encryptKey: z.string().default(''),
  verificationToken: z.string().default(''),
  allowFrom: z.array(z.string()).default([]),
});

const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  consentGranted: z.boolean().default(false),
  imapHost: z.string().min(1),
  imapPort: z.number().int().positive().default(993),
  imapUsername: z.string().min(1),
  imapPassword: z.string().min(1),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().positive().default(587),
  smtpUsername: z.string().min(1),
  smtpPassword: z.string().min(1),
  fromAddress: z.string().email(),
  allowFrom: z.array(z.string()).default([]),
});

  enabled: z.boolean().default(false),
  appId: z.string().min(1),
  secret: z.string().min(1),
  allowFrom: z.array(z.string()).default([]),
});

const ChannelsConfigSchema = z.object({
  whatsapp: WhatsAppConfigSchema,
  feishu: FeishuConfigSchema,
  email: EmailConfigSchema,
});

// 工具配置
const ToolsConfigSchema = z.object({
  restrictToWorkspace: z.boolean().default(false),
  exec: z.object({
    timeout: z.number().int().positive().default(60),
    allowedCommands: z.array(z.string()).default([]),
  }),
  web: z.object({
    search: z.object({
      apiKey: z.string().optional(),
    }),
  }),
});

// 根配置
const ConfigSchema = z.object({
  agents: z.object({
    defaults: AgentDefaultsSchema,
  }),
  providers: z.object({
    openai: ProviderConfigSchema,
    anthropic: ProviderConfigSchema,
    openrouter: ProviderConfigSchema,
    // ... 其他提供商
  }),
  channels: ChannelsConfigSchema,
  tools: ToolsConfigSchema,
});

// 类型导出
export type Config = z.infer<typeof ConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type AgentDefaults = z.infer<typeof AgentDefaultsSchema>;
export type ChannelsConfig = z.infer<typeof ChannelsConfigSchema>;
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;
export type FeishuConfig = z.infer<typeof FeishuConfigSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
```

---

## 6. 渠道实现指南

### 6.1 WhatsApp 渠道 (Baileys)

**技术栈**: `baileys`

**关键特性**:
- WebSocket 连接
- 消息接收和发送
- 媒体文件处理
- 二维码登录
- 群聊和私聊支持

**基础结构**:

```typescript
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
} from 'baileys';
import pino from 'pino';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import { BaseChannel } from './base';

export class WhatsAppChannel extends BaseChannel {
  private socket: WASocket | null = null;
  private readonly logger = pino({ level: 'silent' });

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    this.socket = makeWASocket({
      auth: state,
      printQR: this.handleQR.bind(this),
      logger: this.logger,
      browser: ['Chrome (Linux)', '', ''],
    });

    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const reason = lastDisconnect?.error as DisconnectReason;
        console.log('Connection closed. Reconnecting...', reason);
        this.start();
      } else if (connection === 'open') {
        console.log('WhatsApp connection opened');
      }
    });

    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const msg of messages) {
          await this.handleMessage(msg);
        }
      }
    });

    saveCreds(this.socket?.authState?.creds);
  }

  async stop(): Promise<void> {
    await this.socket?.end();
    this.socket = null;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.socket) {
      throw new Error('WhatsApp socket not connected');
    }

    await this.socket.sendMessage(msg.chatId, { text: msg.content });
  }

  private handleQR(qr: string): void {
    // 生成二维码并显示
    console.log('Scan QR code:', qr);
  }

  private async handleMessage(msg: any): Promise<void> {
    const inbound: InboundMessage = {
      channel: 'whatsapp',
      senderId: msg.key.remoteJid,
      chatId: msg.key.remoteJid,
      content: msg.message?.conversation || '',
      timestamp: new Date(msg.messageTimestamp * 1000),
    };

    await this.bus.publishInbound(inbound);
  }
}
```

### 6.2 Feishu 渠道 (@larksuiteoapi/node-sdk)

**技术栈**: `@larksuiteoapi/node-sdk`

**关键特性**:
- WebSocket 长连接
- 消息接收和发送
- 事件订阅
- 群聊和私聊支持

**基础结构**:

```typescript
import * as lark from '@larksuiteoapi/node-sdk';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import { BaseChannel } from './base';

export class FeishuChannel extends BaseChannel {
  private client: lark.Client | null = null;

  async start(): Promise<void> {
    this.client = new lark.Client({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      disableTokenCache: false,
    });

    // 订阅消息事件
    await this.client.ws.start({
      event_type: 'im.message.receive_v1',
      receive_id: this.config.verificationToken,
    });

    this.client.ws.on('im.message.receive_v1', async (data) => {
      await this.handleMessage(data);
    });
  }

  async stop(): Promise<void> {
    await this.client?.ws.stop();
    this.client = null;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      throw new Error('Feishu client not connected');
    }

    await this.client.im.message.create({
      receive_id_type: 'user_id',
      receive_id: msg.chatId,
      msg_type: 'text',
      content: JSON.stringify({ text: msg.content }),
    });
  }

  private async handleMessage(data: any): Promise<void> {
    const content = JSON.parse(data.event.message.content);
    const inbound: InboundMessage = {
      channel: 'feishu',
      senderId: data.event.sender.sender_id.user_id,
      chatId: data.event.message.chat_id,
      content: content.text || '',
      timestamp: new Date(data.event.message.create_time),
    };

    await this.bus.publishInbound(inbound);
  }
}
```

### 6.3 Email 渠道 (imapflow + nodemailer)

**技术栈**: `imapflow` + `nodemailer`

**关键特性**:
- IMAP 轮询接收邮件
- SMTP 发送邮件
- 支持附件
- 自动回复

**基础结构**:

```typescript
import ImapFlow from 'imapflow';
import nodemailer from 'nodemailer';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import { BaseChannel } from './base';

export class EmailChannel extends BaseChannel {
  private imap: ImapFlow | null = null;
  private smtp: nodemailer.Transporter | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    // IMAP 接收
    this.imap = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: true,
      auth: {
        user: this.config.imapUsername,
        pass: this.config.imapPassword,
      },
    });

    await this.imap.connect();
    console.log('Email IMAP connected');

    // 监听新邮件
    this.imap.on('mail', async (mail) => {
      await this.handleEmail(mail);
    });

    // SMTP 发送
    this.smtp = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: false, // STARTTLS
      auth: {
        user: this.config.smtpUsername,
        pass: this.config.smtpPassword,
      },
    });
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    await this.imap?.close();
    this.smtp?.close();
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.smtp) {
      throw new Error('SMTP not configured');
    }

    await this.smtp.sendMail({
      from: this.config.fromAddress,
      to: msg.chatId,
      subject: msg.metadata.subject || 'Re: ',
      text: msg.content,
    });
  }

  private async handleEmail(mail: any): Promise<void> {
    const inbound: InboundMessage = {
      channel: 'email',
      senderId: mail.from.value[0].address,
      chatId: mail.from.value[0].address,
      content: mail.text || '',
      timestamp: new Date(mail.date),
      metadata: {
        subject: mail.subject,
        hasAttachments: mail.attachments?.length > 0,
      },
    };

    await this.bus.publishInbound(inbound);
  }
}
```


**技术栈**: `botpy-ts`

**关键特性**:
- WebSocket 连接
- 消息接收和发送
- CQHTTP 协议
- 群聊和私聊支持

**基础结构**:

```typescript
import { Bot } from 'botpy-ts';
import type { InboundMessage, OutboundMessage } from '../bus/events';
import { BaseChannel } from './base';

  private bot: Bot | null = null;

  async start(): Promise<void> {
    this.bot = new Bot({
      app_id: this.config.appId,
      app_secret: this.config.secret,
    });

    this.bot.on('message', async (msg) => {
      await this.handleMessage(msg);
    });

    await this.bot.start();
  }

  async stop(): Promise<void> {
    await this.bot?.stop();
    this.bot = null;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.bot) {
    }

    await this.bot.sendPrivateMessage(msg.chatId, msg.content);
  }

  private async handleMessage(msg: any): Promise<void> {
    const inbound: InboundMessage = {
      channel: 'qq',
      senderId: msg.user_id,
      chatId: msg.user_id,
      content: msg.content || '',
      timestamp: new Date(msg.time * 1000),
    };

    await this.bus.publishInbound(inbound);
  }
}
```

---

## 7. LLM Provider 实现

### 7.1 使用 @ai-sdk

```typescript
import { createOpenAI, openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

interface LLMResponse {
  content: string;
  hasToolCalls: boolean;
  toolCalls: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export class AIProvider {
  private openaiProvider: ReturnType<typeof createOpenAI>;
  private anthropicProvider: ReturnType<typeof anthropic>;

  constructor(private config: Config) {
    this.openaiProvider = createOpenAI({
      apiKey: config.providers.openai.apiKey,
      baseURL: config.providers.openai.apiBase,
    });

    this.anthropicProvider = anthropic({
      apiKey: config.providers.anthropic.apiKey,
    });
  }

  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    tools: Array<{ name: string; description: string; parameters: any }>;
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<LLMResponse> {
    // 解析模型提供商
    const [provider, modelName] = this.parseModel(params.model);

    // 选择对应的 provider
    const selectedProvider = provider === 'anthropic'
      ? this.anthropicProvider
      : this.openaiProvider;

    const model = provider === 'anthropic'
      ? anthropic(modelName)
      : openai(modelName);

    // 调用 AI SDK
    const result = await streamText({
      model,
      messages: params.messages,
      tools: params.tools,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    // 解析响应
    const { content, toolCalls, usage } = await this.parseResponse(result);

    return {
      content,
      hasToolCalls: toolCalls.length > 0,
      toolCalls,
      usage,
    };
  }

  private parseModel(model: string): [provider: string, modelName: string] {
    const [provider, modelName] = model.split(':');
    return [provider || 'openai', modelName];
  }

  private async parseResponse(result: any): Promise<{
    content: string;
    toolCalls: ToolCall[];
    usage?: any;
  }> {
    // 解析流式响应...
  }
}
```

---

## 8. 打包和部署

### 8.1 使用 tsup 打包

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node18',
  external: ['pino', 'fs-extra'],
});
```

### 8.2 Docker 部署

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production

CMD ["node", "dist/cli/index.js", "gateway"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  nanobot:
    build: .
    restart: unless-stopped
    volumes:
      - ~/.nanobot:/root/.nanobot
    environment:
      - NODE_ENV=production
```

---

## 9. 性能优化建议

### 9.1 内存优化

- 使用对象池重用消息对象
- 限制会话历史长度
- 及时释放未使用的连接

### 9.2 并发优化

- 使用 Worker Threads 处理 CPU 密集型任务
- 限制并发 LLM 调用数量
- 使用连接池复用 HTTP 连接

### 9.3 日志优化

- 生产环境使用 JSON 格式
- 避免日志中的大对象打印
- 使用采样日志减少输出量

---

## 10. 故障排查

### 10.1 常见问题

**问题**: WhatsApp 连接失败
- 检查网络连接
- 清理 `auth_info_baileys` 文件重新登录
- 查看日志中的详细错误

**问题**: Feishu WebSocket 断开
- 检查 App ID 和 Secret 是否正确
- 确认在飞书开放平台启用了 WebSocket 模式
- 查看是否达到 API 限流

**问题**: Email IMAP 认证失败
- 使用应用专用密码而非主密码
- 检查 IMAP/SMTP 配置
- 确认启用了"允许不够安全的应用"

- 检查沙箱配置是否添加了测试用户
- 确认机器人已发布到生产环境
- 查看服务器日志中的错误信息

### 10.2 调试技巧

```bash
# 启用调试日志
export DEBUG=nanobot:*
nanobot gateway

# 使用 --verbose 标志
nanobot gateway --verbose

# 查看详细日志
pnpm dev 2>&1 | pino-pretty
```
