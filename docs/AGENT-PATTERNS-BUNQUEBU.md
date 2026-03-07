太棒了！bunqueue 完美适合 nanobot-ts 项目。让我分析它如何改变我们的方案：

## bunqueue 与三个方案的关系

### 方案 A：同进程异步任务 → **使用 bunqueue Embedded 模式**

```
┌─────────────────────────────────────────────────────────────┐
│              nanobot-ts 主进程                           │
│                                                       │
│  ┌───────────────────────────────────────────────────┐   │
│  │         AgentLoop (主代理)                        │   │
│  │                                                  │   │
│  │  spawn(task) {                                    │   │
│  │    // ✅ 使用 bunqueue 添加任务                   │   │
│  │    await subagentQueue.add('subagent-task', {     │   │
│  │      task,                                        │   │
│  │      originChannel,                                │   │
│  │      originChatId                                   │   │
│  │    });                                            │   │
│  │    return "子代理任务已提交到队列";                  │   │
│  │  }                                                 │   │
│  └───────────────────┬───────────────────────────────┘   │
│                      │                                   │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐   │
│  │      bunqueue (Embedded Mode, SQLite)            │   │
│  │      - Queue: "subagent-tasks"                  │   │
│  │      - Worker: 内置处理逻辑                       │   │
│  └───────────────────┬───────────────────────────────┘   │
│                      │                                   │
│                      │ Worker.on('completed')               │
│                      ▼                                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │  结果处理回调                                      │   │
│  │  await this.bus.publishInbound({               │   │
│  │    channel: 'system',                           │   │
│  │    content: `[子代理完成] ${result}`             │   │
│  │  });                                            │   │
│  └───────────────────────────────────────────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────────────┘

优势：
✅ 不需要自己实现 SubagentManager
✅ 自动持久化（SQLite WAL 模式）
✅ 内置重试、DLQ、进度跟踪
✅ 286K ops/sec 高性能
✅ 代码量大幅减少
```

### 方案 B：跨进程 IPC → **bunqueue Embedded + fork()**

```
┌──────────────────────────────────────────────────────────────┐
│                父进程 (Main Process)                    │
│                                                        │
│  ┌────────────────────────────────────────────────────┐   │
│  │         AgentLoop (主代理)                      │   │
│  │                                                │   │
│  │  spawn(task) {                                 │   │
│  │    await subagentQueue.add('task', { task });   │   │
│  │    return "任务已添加到队列";                    │   │
│  │  }                                              │   │
│  └──────────────────┬───────────────────────────────┘   │
│                     │                                    │
│                     │ 共享 SQLite 文件（WAL 模式）        │
└─────────────────────┼────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│              bunqueue (Shared SQLite)                     │
│                                                        │
│   Queue: "subagent-tasks"                                │
│   • 父进程通过 Queue.add() 添加任务                      │
│   • 子进程通过 Worker 处理任务                            │
│   • WAL 模式支持并发访问                                  │
└──────────────────────────────────────────────────────────────┘
                      ▲
                      │ Worker 监听队列
                      │
┌─────────────────────┼────────────────────────────────────┐
│                     │                                │
│  ┌──────────────────┴─────────────────────────────┐  │
│  │  子进程 Worker (fork 的独立进程)               │  │
│  │                                               │  │
│  │  new Worker('subagent-tasks', async (job) => {│  │
│  │    const result = await executeTask(           │  │
│  │      job.data.task                              │  │
│  │    );                                          │  │
│  │                                               │  │
│  │    // 通过 SQLite 共享状态发送结果               │  │
│  │    await resultQueue.add('result', {             │  │
│  │      taskId: job.id,                           │  │
│  │      result,                                    │  │
│  │      origin: job.data.origin                      │  │
│  │    });                                          │  │
│  │  }, { embedded: true }); // 共享同一个 SQLite      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────────┘
          │
          │ resultQueue.on('completed')
          ▼
┌──────────────────────────────────────┐
│  父进程监听结果队列               │
│  发布到 MessageBus → AgentLoop       │
└──────────────────────────────────────┘

优势：
✅ 进程隔离，子进程崩溃不影响主进程
✅ 共享 SQLite，无需 IPC 序列化
✅ WAL 模式支持高性能并发
✅ 代码比纯 IPC 简单
```

### 方案 C：外部队列 → **bunqueue TCP 模式**

```
┌────────────────────────────────────┐      ┌─────────────────────────────────────┐
│   nanobot-ts 主进程            │      │   bunqueue TCP Server (独立进程)   │
│                                │      │                                 │
│  ┌──────────────────────────┐   │      │  ┌─────────────────────────┐    │
│  │   AgentLoop (主代理)     │   │      │  │   bunqueue Server     │    │
│  │                         │   │      │  │                     │    │
│  │  const queue = new      │   │      │  │   - SQLite 存储      │    │
│  │    Queue('subagent', {   │   │      │  │   - TCP :6789       │    │
│  │      connection: {       │   │      │  │   - REST API         │    │
│  │        host: 'local-    │   │      │  │   - WebSocket (可选)  │    │
│  │          host',          │   │      │  └───────────┬─────────┘    │
│  │        port: 6789       │   │      └──────────────┼───────────────┘
│  │      }                  │   │                     │                    │
│  │    });                  │   │                     │ TCP 协议            │
│  └──────────┬─────────────┘   │                     │                    │
│             │                 │      ┌──────────────┼───────────────┐
│             │ TCP Client      │      │             ▼               │
│             │                 │      │  ┌─────────────────────┐   │
│             ▼                 │      │  │   Queue: "subagent" │   │
│  ┌──────────────────────┐   │      │  │   Queue: "results"  │   │
│  │  监听结果队列        │   │      │  │   DLQ              │   │
│  │  const resultWorker  │   │      │  └───────────┬─────────┘   │
│  │    = new Worker(    │   │      └──────────────┼───────────────┘
│  │      'results',      │   │                     │
│  │      async (job) => { │   │                     ▼
│  │        await bus.      │   │      ┌─────────────────────────────┐
│  │          publishInbound│   │      │   Worker Pool (独立进程)    │
│  │            ({         │   │      │                           │
│  │              channel:  │   │      │  ┌─────────────────────┐  │
│  │                'system',│   │      │  │  Worker 1          │  │
│  │              content:  │   │      │  │  - 处理 subagent   │  │
│  │                job.data│   │      │  │  - 调用 LLM        │  │
│  │                  .result│   │      │  │  - 执行工具         │  │
│  │            });       │   │      │  └─────────────────────┘  │
│  │      }              │   │      │  ┌─────────────────────┐  │
│  │    }, { connection:  │   │      │  │  Worker 2          │  │
│  │      { host: 'local- │   │      │  │  - 处理 subagent   │  │
│  │        host',        │   │      │  └─────────────────────┘  │
│  │        port: 6789    │   │      └─────────────────────────────┘
│  │      }                │   │
│  │    });                │   │
│  └──────────────────────┘   │
└────────────────────────────┘      └─────────────────────────────────────┘

优势：
✅ 零配置部署（无需 Redis）
✅ 支持多机分布式
✅ 内置监控和 Prometheus 指标
✅ HTTP API + TCP 双协议
✅ 可扩展为多个 worker 进程
```

## 综合对比：不使用 vs 使用 bunqueue

```
┌──────────────┬───────────────────┬──────────────────────┐
│     特性     │   自己实现       │   使用 bunqueue      │
├──────────────┼───────────────────┼──────────────────────┤
│ 方案 A       │ 自己实现         │ Embedded 模式       │
│   代码量     │ 500-800 行      │ 50-100 行          │
│   持久化     │ 需要自己实现     │ SQLite WAL 自动     │
│   重试机制    │ 需要自己实现     │ 内置 (attempts)    │
│   DLQ        │ 需要自己实现     │ 内置              │
│   监控       │ 需要自己实现     │ 内置 stats/logs     │
├──────────────┼───────────────────┼──────────────────────┤
│ 方案 B       │ 自己实现 IPC     │ Embedded + fork()   │
│   通信方式    │ MessageChannel    │ 共享 SQLite        │
│   序列化      │ structured clone │ 无需序列化         │
│   复杂度      │ ⭐⭐⭐⭐         │ ⭐⭐              │
├──────────────┼───────────────────┼──────────────────────┤
│ 方案 C       │ Redis/NATS      │ bunqueue TCP       │
│   外部依赖    │ Redis/MongoDB    │ 无（仅 SQLite）     │
│   性能        │ Redis ~50K ops   │ 149K ops/sec      │
│   运维成本    │ 高（需要维护 Redis）│ 低（单一进程）      │
│   配置复杂度   │ 中等            │ 极低              │
│   MCP 支持     │ ❌              │ ✅ 73 工具         │
└──────────────┴───────────────────┴──────────────────────┘
```

## 推荐方案：基于 bunqueue 的混合方案

我建议采用一个渐进式的实现策略：

### 阶段 1：快速实现（方案 A + bunqueue Embedded）
```typescript
// 1. 安装 bunqueue
bun add bunqueue

// 2. 修改 SpawnTool 使用 bunqueue
import { Queue, Worker } from 'bunqueue/client';

// 主进程中创建队列
const subagentQueue = new Queue('subagent-tasks', { 
  embedded: true 
});

// 内置 Worker 处理任务
const worker = new Worker('subagent-tasks', async (job) => {
  const { task, originChannel, originChatId } = job.data;
  const result = await executeSubagentTask(task);
  
  // 发布结果到结果队列
  await resultQueue.add('subagent-result', {
    result,
    origin: { channel: originChannel, chatId: originChatId }
  });
}, { embedded: true });

// 3. 监听结果队列
const resultWorker = new Worker('subagent-results', async (job) => {
  await this.bus.publishInbound({
    channel: 'system',
    content: `[子代理完成] ${job.data.result}`
  });
}, { embedded: true });
```

### 阶段 2：增强稳定性（方案 B 变体）
- 添加 `--worker` 命令启动独立 Worker 进程
- Worker 连接到主进程的 SQLite
- 支持水平扩展（多个 Worker 进程）

### 阶段 3：生产级部署（方案 C）
- 使用 bunqueue TCP 模式
- 独立的队列服务器进程
- 支持多机部署和负载均衡

## 你希望如何进行？

**选项 1**：直接实现阶段 1（最简单，1-2 天完成）
**选项 2**：实现完整的阶段 1 + 2（推荐，3-5 天完成）
**选项 3**：直接实现阶段 3（生产级，1-2 周完成）
**选项 4**：让我详细设计每个阶段的实现计划

