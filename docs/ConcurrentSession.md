完美！我已经深入分析了 opencode 的多会话实现。现在让我为你设计一个基于 opencode 架构的多会话方案。

## 📊 OpenCode 多会话架构分析

### 核心设计理念

1. **会话隔离**：每个会话有独立的 sessionID、AbortController 和回调队列
2. **并发处理**：多个会话可以同时处理，互不干扰
3. **状态管理**：使用 `Instance.state()` 管理项目级状态（内存 Map）
4. **事件驱动**：通过 Bus 系统和 SSE 实现实时推送

### 关键组件

```
┌─────────────────────────────────────────────────────────────┐
│              Instance.state() (项目级状态)                   │
│  Record<sessionID, {                                      │
│    abort: AbortController,                                 │
│    callbacks: Array<{resolve, reject}>                      │
│  }>                                                        │
└─────────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    SessionStatus                  SessionPrompt
  (会话运行状态)               (会话处理循环)
         │                               │
         └───────────────┬───────────────┘
                         │
                    SessionProcessor
              (处理 LLM 流和工具调用)
```

---

## 🎯 nanobot 多会话架构设计方案

### 一、核心组件设计

#### 1.1 SessionStatus（会话状态管理器）

**位置**: `packages/main/src/core/session-status.ts`

```typescript
export namespace SessionStatus {
  // 会话状态类型
  export type Status =
    | { type: "idle" }                    // 空闲
    | { type: "busy" }                    // 正在处理
    | { type: "retry"; attempt: number; message: string; next: number }  // 重试中
    | { type: "error"; error: string }     // 错误

  // 状态存储（内存）
  const state = new Map<string, Status>()

  // 获取会话状态
  export function get(sessionKey: string): Status {
    return state.get(sessionKey) ?? { type: "idle" }
  }

  // 设置会话状态
  export function set(sessionKey: string, status: Status): void {
    state.set(sessionKey, status)
    // 发布事件
    MessageBus.emit('session-status', { sessionKey, status })
  }

  // 列出所有会话状态
  export function list(): Record<string, Status> {
    return Object.fromEntries(state)
  }

  // 清理会话状态
  export function clear(sessionKey: string): void {
    state.delete(sessionKey)
  }

  // 清理所有状态（关闭时调用）
  export function clearAll(): void {
    state.clear()
  }
}
```

---

#### 1.2 SessionProcessor（会话处理器）

**位置**: `packages/main/src/core/session-processor.ts`

```typescript
export class SessionProcessor {
  private abortController: AbortController
  private sessionKey: string
  private channel: string
  private chatId: string

  constructor(sessionKey: string, channel: string, chatId: string) {
    this.sessionKey = sessionKey
    this.channel = channel
    this.chatId = chatId
    this.abortController = new AbortController()
  }

  get signal(): AbortSignal {
    return this.abortController.signal
  }

  // 处理单个消息
  async processMessage(message: InboundMessage): Promise<OutboundMessage | null> {
    SessionStatus.set(this.sessionKey, { type: "busy" })

    try {
      // 1. 追加用户消息到会话
      await this.sessionOrchestrator.appendUserMessage(this.sessionKey, userMessage)

      // 2. 构建提示消息
      const messages = await this.sessionOrchestrator.buildPromptMessages(...)

      // 3. 流式处理 LLM 响应
      const { assistantContent, finalUIMessage } = await this.streamBridge.streamAndEmit({
        messages,
        tools,
        model,
        temperature,
        maxTokens,
        abortSignal: this.signal,
        executeTool: (name, args) => this.toolRuntime.executeTool(name, args, {
          channel: this.channel,
          chatId: this.chatId
        })
      })

      // 4. 追加助手消息
      await this.sessionOrchestrator.appendAssistantMessage(this.sessionKey, assistantMessage)

      // 5. 可选：合并记忆
      await this.sessionOrchestrator.maybeConsolidate(this.sessionKey)

      SessionStatus.set(this.sessionKey, { type: "idle" })

      return { channel: this.channel, chatId: this.chatId, content: finalAssistantContent }
    } catch (error) {
      SessionStatus.set(this.sessionKey, { type: "error", error: String(error) })
      throw error
    }
  }

  // 取消处理
  abort(): void {
    this.abortController.abort()
  }
}
```

---

#### 1.3 ConcurrentSessionManager（并发会话管理器）

**位置**: `packages/main/src/core/concurrent-session-manager.ts`

```typescript
export class ConcurrentSessionManager {
  // 活跃的会话处理器
  private readonly processors = new Map<string, SessionProcessor>()

  // 会话状态
  private readonly state = new Map<string, {
    abort: AbortController
    callbacks: Array<{
      resolve: (result: OutboundMessage | null) => void
      reject: (error: any) => void
    }>
  }>()

  // 开始会话处理
  async start(sessionKey: string, channel: string, chatId: string): Promise<void> {
    const existing = this.processors.get(sessionKey)
    if (existing) return

    const processor = new SessionProcessor(sessionKey, channel, chatId)
    this.processors.set(sessionKey, processor)
  }

  // 处理消息
  async process(sessionKey: string, message: InboundMessage): Promise<OutboundMessage | null> {
    // 检查是否有正在进行的处理
    const existing = this.state.get(sessionKey)
    if (existing) {
      // 添加到回调队列
      return new Promise((resolve, reject) => {
        existing.callbacks.push({ resolve, reject })
      })
    }

    // 创建新的处理状态
    const abort = new AbortController()
    this.state.set(sessionKey, {
      abort,
      callbacks: []
    })

    try {
      const processor = this.processors.get(sessionKey)!
      const result = await processor.processMessage(message)
      
      // 触发回调队列
      const callbacks = this.state.get(sessionKey)?.callbacks ?? []
      for (const callback of callbacks) {
        callback.resolve(result)
      }
      
      return result
    } finally {
      this.state.delete(sessionKey)
    }
  }

  // 取消会话
  cancel(sessionKey: string): void {
    const processor = this.processors.get(sessionKey)
    if (processor) {
      processor.abort()
    }
    
    const state = this.state.get(sessionKey)
    if (state) {
      state.abort.abort()
      for (const callback of state.callbacks) {
        callback.reject(new Error('Session cancelled'))
      }
      this.state.delete(sessionKey)
    }
    
    SessionStatus.clear(sessionKey)
  }

  // 清理所有会话
  clearAll(): void {
    for (const sessionKey of this.processors.keys()) {
      this.cancel(sessionKey)
    }
    this.processors.clear()
  }

  // 获取所有活跃会话
  getActiveSessions(): string[] {
    return Array.from(this.processors.keys())
  }
}
```

---

### 二、AgentLoop 改造

**位置**: `packages/main/src/core/agent.ts`

```typescript
export class AgentLoop {
  private concurrentSessionManager: ConcurrentSessionManager
  private workerCount: number

  constructor(...) {
    this.concurrentSessionManager = new ConcurrentSessionManager()
    this.workerCount = config.concurrent?.maxConcurrency ?? 5
  }

  async run(): Promise<void> {
    while (this.running) {
      // 使用 WorkerPool 并发处理消息
      const workers = Array.from({ length: this.workerCount }, () => 
        this.processSingleMessage()
      )
      
      // 等待任意一个 worker 完成
      await Promise.race(workers)
    }
  }

  private async processSingleMessage(): Promise<void> {
    const msg = await this.bus.consumeInbound()
    if (!msg) return

    const sessionKey = getSessionKey(msg)
    
    // 开始会话（如果尚未开始）
    await this.concurrentSessionManager.start(sessionKey, msg.channel, msg.chatId)
    
    // 并发处理消息
    try {
      const response = await this.concurrentSessionManager.process(sessionKey, msg)
      if (response) {
        await this.bus.publishOutbound(response)
      }
    } catch (error) {
      console.error('Message processing error:', error)
    }
  }
}
```

---

### 三、Session 数据模型扩展

**位置**: `packages/shared/src/config/session-schema.ts`

```typescript
export interface Session {
  key: string;
  
  // 元数据
  name?: string;                    // 用户自定义名称
  title?: string;                   // 自动生成的标题
  tags: string[];                   // 标签
  archived: boolean;                // 是否归档
  archivedAt?: string;              // 归档时间
  pinned: boolean;                  // 是否置顶
  
  // 运行时信息
  channel: string;                  // 所属渠道
  chatId: string;                   // 所属会话ID
  model: string;                    // 使用的模型
  messageCount: number;             // 消息总数
  lastActiveAt: string;            // 最后活跃时间
  
  // 原有字段
  messages: SessionMessage[];
  lastConsolidated: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMetadata {
  tags: string[];
  archived: boolean;
  archivedAt?: string;
  model: string;
  messageCount: number;
  channel: string;
  chatId: string;
  lastActiveAt: string;
  pinned: boolean;
}
```

---

### 四、API 端点扩展

**位置**: `packages/server/src/routes/sessions.ts`

```typescript
export const sessionsRoutes = new Hono()
  // 会话管理
  .get('/', listSessions)                    // 列出所有会话（支持分页、过滤、搜索）
  .get('/:key', getSession)                  // 获取会话详情
  .post('/', createSession)                  // 创建新会话
  .put('/:key', updateSession)               // 更新会话（重命名、标签）
  .delete('/:key', deleteSession)            // 删除会话
  .put('/:key/archive', archiveSession)      // 归档/取消归档
  .put('/:key/pin', pinSession)              // 置顶/取消置顶
  
  // 会话状态
  .get('/status', getAllSessionStatus)       // 获取所有会话状态
  .get('/:key/status', getSessionStatus)     // 获取指定会话状态
  .post('/:key/abort', abortSession)         // 取消会话处理
  
  // 消息操作
  .post('/:key/messages', sendMessage)        // 发送消息到指定会话
  .delete('/:key/messages', clearMessages)   // 清空会话消息
  
  // 导入导出
  .get('/:key/export', exportSession)        // 导出会话
  .post('/import', importSession)            // 导入会话
  
  // 搜索
  .get('/search', searchSessions)            // 搜索会话

// SSE 事件流
sessionsRoutes.get('/:key/events', sessionEventStream)
```

---

### 五、数据库迁移

**位置**: `packages/main/src/storage/migrations/`

```sql
-- 添加会话元数据字段
ALTER TABLE sessions ADD COLUMN name TEXT;
ALTER TABLE sessions ADD COLUMN title TEXT;
ALTER TABLE sessions ADD COLUMN tags TEXT DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN archived INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN archived_at TEXT;
ALTER TABLE sessions ADD COLUMN model TEXT;
ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN channel TEXT;
ALTER TABLE sessions ADD COLUMN chat_id TEXT;
ALTER TABLE sessions ADD COLUMN last_active_at TEXT;
ALTER TABLE sessions ADD COLUMN pinned INTEGER DEFAULT 0;

-- 创建索引
CREATE INDEX idx_sessions_archived ON sessions(archived, last_active_at);
CREATE INDEX idx_sessions_channel_chat ON sessions(channel, chat_id);
CREATE INDEX idx_sessions_pinned ON sessions(pinned, last_active_at);
```

---

### 六、实现计划

#### Phase 1: 核心架构（基础）
1. **SessionStatus** - 会话状态管理器
2. **SessionProcessor** - 会话处理器
3. **ConcurrentSessionManager** - 并发会话管理器
4. **AgentLoop 改造** - 支持并发处理

#### Phase 2: 数据层扩展
5. **Session 数据模型扩展**
6. **数据库迁移脚本**
7. **SessionManager 方法扩展**
8. **会话标题生成器**

#### Phase 3: API 层
9. **会话管理 API**
10. **会话状态 API**
11. **SSE 事件流**
12. **搜索和过滤 API**

#### Phase 4: Web UI
13. **会话列表侧边栏**
14. **会话切换组件**
15. **会话管理功能**
16. **实时状态更新**

#### Phase 5: 优化和增强
17. **性能监控**
18. **并发度配置**
19. **错误处理和重试**
20. **导入导出功能**

---

### 七、配置选项

**位置**: `packages/shared/src/config/config-schema.ts`

```typescript
export interface ConcurrentConfig {
  enabled: boolean;           // 是否启用并发
  maxConcurrency: number;     // 最大并发数（默认 5）
  sessionTimeout: number;      // 会话超时时间（默认 30秒）
  prioritizeRecent: boolean;   // 优先处理最近活跃的会话
}

export interface SessionManagementConfig {
  autoTitle: boolean;          // 自动生成标题
  maxSessions: number;         // 最大会话数（0 = 无限制）
  archiveOld: boolean;        // 自动归档旧会话
  archiveAfterDays: number;    // 归档天数
}
```

---

### 八、优势总结

✅ **完全并发**：多个会话可以同时处理，无阻塞  
✅ **会话隔离**：每个会话有独立的状态和 AbortController  
✅ **优雅的架构**：基于 opencode 成功的设计模式  
✅ **实时状态**：通过 SessionStatus 和 SSE 实时推送状态  
✅ **向后兼容**：可以选择性启用并发模式  
✅ **可扩展**：易于添加新功能（如会话分组、标签等）

---

这个方案完全基于 opencode 的成熟架构，结合了 nanobot 的现有设计。



## 🔄 多会话并发处理流程图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Channel Layer                                │
│  (WhatsApp, Feishu, Email, CLI, HTTP)                                │
│                                                                      │
│  InboundMessage: { channel, chatId, content, ... }                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MessageBus (EventEmitter)                        │
│                                                                      │
│  ┌─────────────────┐    ┌──────────────────┐                        │
│  │ inboundQueue    │    │ outboundQueue   │                        │
│  │ [msg1, msg2...]│    │ [msg1, msg2...] │                        │
│  └────────┬────────┘    └────────┬─────────┘                        │
│           │                      │                                   │
│           │ emit('inbound')     │ emit('outbound')                  │
│           ▼                      ▼                                   │
│    ┌──────────────┐      ┌───────────────┐                          │
│    │ SSE Stream   │      │  Channels     │                          │
│    │ (real-time)  │      │  dispatcher   │                          │
│    └──────────────┘      └───────────────┘                          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   ConcurrentSessionManager                             │
│                                                                      │
│  processors: Map<sessionKey, SessionProcessor>                      │
│  state: Map<sessionKey, { abort, callbacks[] }>                     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  process(sessionKey, message)                         │          │
│  │                                                      │          │
│  │  1. Check if session is busy                          │          │
│  │     └─ Yes: Add to callback queue                     │          │
│  │     └─ No:  Create new processor state                │          │
│  │                                                      │          │
│  │  2. processor.processMessage(message)                  │          │
│  │     └─ Update SessionStatus: busy                    │          │
│  │     └─ Append user message to session                 │          │
│  │     └─ Build prompt messages                         │          │
│  │     └─ Stream LLM response (with tools)              │          │
│  │     └─ Append assistant message to session            │          │
│  │     └─ Maybe consolidate memory                      │          │
│  │     └─ Update SessionStatus: idle                   │          │
│  │                                                      │          │
│  │  3. Trigger callback queue                          │          │
│  └──────────────────────────────────────────────────────────┘          │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SessionStatus (Map)                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐           │
│  │ sessionKey → Status                                   │           │
│  │                                                         │           │
│  │ "whatsapp:user123" → { type: "busy" }                │           │
│  │ "feishu:group456"  → { type: "idle" }                │           │
│  │ "cli:default"      → { type: "retry", attempt: 2,   │           │
│  │                        next: 1234567890 }           │           │
│  └────────────────────────────────────────────────────────┘           │
│                                                                      │
│  Events: emit('session-status', { sessionKey, status })              │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SessionProcessor (Per Session)                      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  processMessage(message)                               │          │
│  │                                                          │          │
│  │  ┌─────────────────────────────────────────┐             │          │
│  │  │ SessionOrchestrator.appendUserMessage() │             │          │
│  │  │  - Add to session.messages            │             │          │
│  │  │  - Update session.metadata            │             │          │
│  │  └─────────────────────────────────────────┘             │          │
│  │                          │                                  │          │
│  │                          ▼                                  │          │
│  │  ┌─────────────────────────────────────────┐             │          │
│  │  │ SessionOrchestrator.buildPrompt()      │             │          │
│  │  │  - System prompt (AGENTS.md, etc.)    │             │          │
│  │  │  - Session history                    │             │          │
│  │  │  - Current message                    │             │          │
│  │  └─────────────────────────────────────────┘             │          │
│  │                          │                                  │          │
│  │                          ▼                                  │          │
│  │  ┌─────────────────────────────────────────┐             │          │
│  │  │ StreamBridge.streamAndEmit()          │             │          │
│  │  │  ├─ LLM stream (streamText)           │             │          │
│  │  │  ├─ Tool execution (async)           │             │          │
│  │  │  └─ Emit events (SSE)                │             │          │
│  │  └─────────────────────────────────────────┘             │          │
│  │                          │                                  │          │
│  │                          ▼                                  │          │
│  │  ┌─────────────────────────────────────────┐             │          │
│  │  │ SessionOrchestrator.appendAssistant()  │             │          │
│  │  │  - Add to session.messages            │             │          │
│  │  └─────────────────────────────────────────┘             │          │
│  │                          │                                  │          │
│  │                          ▼                                  │          │
│  │  ┌─────────────────────────────────────────┐             │          │
│  │  │ SessionOrchestrator.maybeConsolidate()│             │          │
│  │  │  - Check threshold (50 msgs)          │             │          │
│  │  │  - Summarize to MEMORY.md            │             │          │
│  │  └─────────────────────────────────────────┘             │          │
│  │                                                          │          │
│  │  Return OutboundMessage                                  │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                      │
│  AbortController: Can cancel at any time                            │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SessionManager (SQLite)                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │  getOrCreate(sessionKey)                                 │          │
│  │  addMessage(sessionKey, message)                           │          │
│  │  getHistory(sessionKey, maxMessages)                      │          │
│  │  clear(sessionKey)                                        │          │
│  │  listSessions()                                            │          │
│  └──────────────────────────────────────────────────────────┘          │
│                                                                      │
│  Database: SQLite (Drizzle ORM)                                    │
│  Tables: sessions, session_messages                                 │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Web UI (Dashboard)                            │
│                                                                      │
│  ┌────────────────┐  ┌──────────────────────────────────────┐        │
│  │  Session List  │  │   Chat Interface                     │        │
│  │                │  │                                      │        │
│  │  ⭐ Project A  │  │  ┌───────────────────────────────┐ │        │
│  │  💬 Code Review│  │  │ User: Help me refactor...   │ │        │
│  │  💬 Debug      │  │  │                              │ │        │
│  │  📦 Archived   │  │  │ Assistant: I'll help you...   │ │        │
│  │                │  │  │                              │ │        │
│  │  [+ New Chat]  │  │  │ [Tool: read_file]           │ │        │
│  └────────────────┘  │  └───────────────────────────────┘ │        │
│        │             │                                      │        │
│        │ Switch      │ Status: busy 🔵 / idle ⚪          │        │
│        └─────────────┴──────────────────────────────────────┘        │
│                                                                      │
│  SSE Events: session-status, stream-part, stream-finish                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 并发处理时序图

```
Time → 
────────────────────────────────────────────────────────────────────

Session A (WhatsApp):    │      busy     │ busy │ idle │
                        ├──────────────────────────────►
                        msg1          msg2

Session B (Feishu):      │     busy     │ idle │
                        ├─────────────────►
                        msg1

Session C (CLI):         │ busy │
                        └──────►
                        msg1

Worker Pool (5 workers):  │ W1 │ W2 │ W3 │ W4 │ W5 │
                        └──────────────────────────────►
                          A1   B1   A2   C1   ...

Message Bus:             ┌───┐   ┌───┐   ┌───┐
                        │msg1│   │msg2│   │msg3│
                        └─┬─┘   └─┬─┘   └─┬─┘
                          ▼       ▼       ▼
                      ConcurrentSessionManager
                          │       │       │
                  ┌───────┼───────┼───────┐
                  ▼       ▼       ▼       ▼
              SessionStatus (3 sessions)
                  │       │       │
                  ▼       ▼       ▼
              SessionProcessor (3 instances)
                  │       │       │
                  └───────┼───────┘
                          ▼
                     OutboundMessages
                          │
                          ▼
                      Channels
```

---

## 🔑 关键设计要点

### 1. 会话隔离
- 每个 sessionKey 有独立的 SessionProcessor
- 每个 Processor 有独立的 AbortController
- 同一会话的消息串行处理（通过 callback queue）
- 不同会话的消息并行处理

### 2. 状态管理
- SessionStatus: 内存 Map，记录所有会话状态
- ConcurrentSessionManager: 管理 Processor 生命周期
- SessionManager: 持久化层（SQLite）

### 3. 并发控制
- Worker Pool 默认 5 个并发
- 可配置 maxConcurrency
- 每个会话的 callback queue 保证顺序

### 4. 取消机制
- AbortController 可以随时取消正在进行的会话
- SSE 实时推送状态变化
- 超时自动取消

---

## ✅ 实施检查清单

**Phase 1: 核心架构**
- [ ] SessionStatus 模块
- [ ] SessionProcessor 类
- [ ] ConcurrentSessionManager 类
- [ ] AgentLoop 改造（并发模式）

**Phase 2: 数据层**
- [ ] Session 数据模型扩展
- [ ] 数据库迁移脚本
- [ ] SessionManager 方法扩展
- [ ] 会话标题生成器

**Phase 3: API 层**
- [ ] 会话管理 API
- [ ] 会话状态 API
- [ ] SSE 事件流优化
- [ ] 搜索和过滤 API

**Phase 4: Web UI**
- [ ] 会话列表侧边栏
- [ ] 会话切换组件
- [ ] 会话管理功能
- [ ] 实时状态显示

**Phase 5: 优化**
- [ ] 性能监控
- [ ] 错误处理
- [ ] 配置选项
- [ ] 测试覆盖

---

流程图和实施计划都清晰了！如果你确认没有问题，我们就可以开始实施了。请问：

1. **并发数配置**：默认 5 个并发可以吗？还是需要调整？
2. **会话隔离策略**：同一会话的消息串行处理，不同会话并行处理 - 这样可以吗？
3. **是否现在开始实施？**