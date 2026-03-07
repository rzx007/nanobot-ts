# Subagent 实现计划

## 📋 概述

基于 `bunqueue` 实现一个灵活的 Subagent 系统，支持两种运行模式：

- **Embedded 模式**（默认）：队列和 worker 在同一个进程内运行
- **Isolated 模式**：主进程管理队列，worker 进程独立运行

通过配置文件或命令行参数切换模式，无需修改代码。

## 🎯 用户确认的设计决策

1. **旧工具处理**: 保留 `spawn.ts`，标记为 deprecated，推荐使用新的 `subagent` 工具
2. **工具集**: 共享主代理的工具集（但排除 spawn 和 message 工具）
3. **配置优先级**: 命令行参数 > 配置文件 > 默认值
4. **数据持久化**: 只持久化运行中的任务，完成后立即清理
5. **默认模式**: `embedded` 模式

## 📐 架构设计

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    nanobot-ts 主进程                     │
│                                                         │
│  ┌───────────────────────────────────────────────────┐   │
│  │         AgentLoop (主代理)                        │   │
│  │  • 处理用户消息                                │   │
│  │  • 调用 subagent 工具                          │   │
│  └───────────────────┬───────────────────────────────┘   │
│                      │                                   │
│                      ▼                                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │      SubagentManager (新增核心类)                │   │
│  │  • 管理 subagent 任务队列                      │   │
│  │  • 跟踪运行状态                                 │   │
│  │  • 处理结果回调                                 │   │
│  │  • 支持 cancel 操作                               │   │
│  └───────────────────┬───────────────────────────────┘   │
│                      │                                   │
│                      ▼                                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │              bunqueue (SQLite)                    │   │
│  │  • Queue: 'subagent-tasks'                    │   │
│  │  • Queue: 'subagent-results'                   │   │
│  └───────────────┬───────────────────────────────┘   │
│                  │                                       │
│         ┌────────┴────────┐                           │
│         │                 │                           │
│         ▼                 ▼                           │
│  ┌─────────────┐   ┌─────────────┐                   │
│  │ Worker 1   │   │ Worker 2   │                   │
│  │ (Embedded/  │   │ (Embedded/  │                   │
│  │  Forked)    │   │  Forked)    │                   │
│  └──────┬──────┘   └──────┬──────┘                   │
│         │                 │                           │
│         └────────┬────────┘                           │
│                  │                                   │
│                  ▼                                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │           结果队列监听器                            │   │
│  │  • 监听 'subagent-results' 队列               │   │
│  │  • 发布到 MessageBus (system 消息）             │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────────┘
```

### 双模式对比

| 特性        | Embedded 模式    | Isolated 模式          |
| ----------- | ---------------- | ---------------------- |
| Worker 位置 | 主进程内         | 独立进程               |
| 进程数      | 1                | 1+N (主进程+N个worker) |
| 内存共享    | 完全共享         | 通过 SQLite 共享       |
| 崩溃影响    | 可能影响主进程   | 隔离，不影响主进程     |
| 性能        | 最高（无序列化） | 稍低（需要序列化）     |
| 适用场景    | 个人助手、开发   | 生产环境、高稳定性     |

## 📁 文件结构

```
src/
├── core/
│   └── subagent/
│       ├── manager.ts          # SubagentManager 核心类
│       ├── worker.ts          # 子代理执行逻辑
│       └── types.ts         # 类型定义
├── tools/
│   ├── subagent.ts          # 新的 subagent 工具
│   └── spawn.ts           # 保留，标记为 deprecated
├── config/
│   └── schema.ts           # 新增 SubagentConfigSchema
└── cli/
    └── commands/
        └── subagent/
            ├── start-worker.ts  # 启动独立 worker 进程
            └── index.ts       # 子代理相关命令

tests/
├── unit/
│   └── subagent/
│       ├── manager.test.ts
│       └── worker.test.ts
└── integration/
    └── subagent.test.ts

docs/
└── subagent-implementation.md   # 本文档
```

## 🔧 实现步骤

### 阶段 1：基础设施（1-2 天）

#### 任务 1.1：安装 bunqueue

```bash
bun add bunqueue
```

#### 任务 1.2：定义配置 Schema

**文件**: `src/config/schema.ts`

**内容**:

```typescript
export const SubagentConfigSchema = z.object({
  /** 是否启用 subagent */
  enabled: z.boolean().default(true),

  /** 执行模式 */
  mode: z.enum(['embedded', 'isolated']).default('embedded'),

  /** 最大并发数 */
  concurrency: z.number().int().positive().default(3),

  /** 子代理最大迭代次数 */
  maxIterations: z.number().int().positive().default(15),

  /** 子代理超时时间（秒） */
  timeout: z.number().int().positive().default(300),

  /** bunqueue 数据路径 */
  dataPath: z.string().default('./data/bunqueue.db'),
});

// 添加到主配置 Schema
export const ConfigSchema = z.object({
  // ... 现有配置 ...
  subagent: SubagentConfigSchema,
});
```

#### 任务 1.3：创建类型定义

**文件**: `src/core/subagent/types.ts`

**内容**:

```typescript
export interface SubagentTask {
  /** 任务唯一 ID */
  taskId: string;

  /** 任务描述 */
  task: string;

  /** 可选标签 */
  label?: string;

  /** 来源渠道 */
  originChannel: string;

  /** 来源聊天 ID */
  originChatId: string;

  /** 会话密钥 */
  sessionKey: string;

  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** 创建时间 */
  createdAt: Date;

  /** 开始时间 */
  startedAt?: Date;

  /** 完成时间 */
  completedAt?: Date;

  /** 错误信息（如果失败） */
  error?: string;
}

export interface SubagentResult {
  /** 任务 ID */
  taskId: string;

  /** 执行结果 */
  result: string;

  /** 状态 */
  status: 'completed' | 'failed';

  /** 错误信息（可选） */
  error?: string;

  /** 完成时间 */
  completedAt: Date;
}

export interface SubagentManagerConfig {
  /** 消息总线 */
  bus: import('../bus/types').MessageBus;

  /** LLM 提供商 */
  provider: import('../providers').LLMProvider;

  /** 工具注册表 */
  tools: import('../tools').ToolRegistry;

  /** 工作区路径 */
  workspace: string;

  /** 子代理配置 */
  subagentConfig: {
    enabled: boolean;
    mode: 'embedded' | 'isolated';
    concurrency: number;
    maxIterations: number;
    timeout: number;
    dataPath: string;
  };
}

export type SubagentMode = 'embedded' | 'isolated';
```

#### 任务 1.4：创建 Worker 逻辑

**文件**: `src/core/subagent/worker.ts`

**功能**:

- 执行子代理任务（LLM 调用 + 工具执行）
- 复用主代理的工具集（但排除 spawn 和 message）
- 最大 15 次迭代
- 超时处理
- 返回结果到队列

**核心方法**:

```typescript
export class SubagentWorker {
  private tools: ToolRegistry;
  private provider: LLMProvider;
  private workspace: string;
  private maxIterations: number;
  private timeout: number;

  async execute(jobData: SubagentTask): Promise<SubagentResult> {
    const { taskId, task, originChannel, originChatId } = jobData;

    try {
      // 构建子代理工具集（排除 spawn 和 message）
      const tools = this.buildFilteredToolSet();

      // 执行 LLM 循环
      const result = await this.runAgentLoop(task, tools);

      return {
        taskId,
        result,
        status: 'completed',
        completedAt: new Date(),
      };
    } catch (error) {
      return {
        taskId,
        result: '',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      };
    }
  }

  private buildFilteredToolSet(): ToolRegistry {
    // 创建新的工具注册表
    const registry = new ToolRegistry();

    // 复用主代理的工具（排除 spawn 和 message）
    const allTools = this.tools.getAllTools();
    for (const [name, tool] of Object.entries(allTools)) {
      // 跳过 spawn 和 message 工具
      if (name === 'spawn' || name === 'message') {
        continue;
      }
      registry.register(tool);
    }

    return registry;
  }
}
```

#### 任务 1.5：创建 Manager 核心类

**文件**: `src/core/subagent/manager.ts`

**功能**:

- 初始化 bunqueue Queue 和 Worker
- spawn() 方法：添加任务到队列
- cancel() 方法：取消任务
- handleResult() 方法：处理结果并发布到 MessageBus
- 支持两种模式的切换

**核心方法**:

```typescript
export class SubagentManager {
  private config: SubagentManagerConfig;
  private mode: SubagentMode;
  private taskQueue: Queue;
  private resultQueue: Queue;
  private taskWorker: Worker;
  private resultWorker: Worker;
  private runningTasks: Map<string, Promise<void>> = new Map();

  async initialize(): Promise<void> {
    this.mode = this.config.subagentConfig.mode;

    // 创建队列
    this.taskQueue = new Queue('subagent-tasks', {
      embedded: true,
      dataPath: this.config.subagentConfig.dataPath,
    });

    this.resultQueue = new Queue('subagent-results', {
      embedded: true,
      dataPath: this.config.subagentConfig.dataPath,
    });

    // 根据模式初始化
    if (this.mode === 'embedded') {
      await this.initializeEmbeddedMode();
    } else {
      await this.initializeIsolatedMode();
    }

    // 监听结果队列
    this.resultWorker = new Worker(
      'subagent-results',
      async job => {
        await this.handleResult(job.data);
      },
      { embedded: true },
    );
  }

  async spawn(
    task: string,
    options?: {
      label?: string;
      originChannel?: string;
      originChatId?: string;
      sessionKey?: string;
    },
  ): Promise<string> {
    const taskId = generateTaskId();
    const taskData: SubagentTask = {
      taskId,
      task,
      label: options?.label,
      originChannel: options?.originChannel || 'cli',
      originChatId: options?.originChatId || 'direct',
      sessionKey: options?.sessionKey || 'cli:direct',
      status: 'pending',
      createdAt: new Date(),
    };

    // 添加到队列
    await this.taskQueue.add(taskId, taskData);

    // 跟踪任务
    this.runningTasks.set(taskId, Promise.resolve());

    return `Subagent task "${task}" started (id: ${taskId}). I'll notify you when it completes.`;
  }

  private async handleResult(result: SubagentResult): Promise<void> {
    // 移除运行中的任务跟踪
    this.runningTasks.delete(result.taskId);

    // 构建系统消息
    const task = await this.getTaskById(result.taskId);
    const label = task?.label || result.taskId;

    const content = `[Subagent '${label}' ${result.status}]

Task: ${task?.task || result.taskId}

Result:
${result.result}

Summarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs.`;

    // 发布到 MessageBus
    await this.config.bus.publishInbound({
      channel: 'system',
      senderId: 'subagent',
      chatId: task?.originChatId || 'cli:direct',
      content,
    });
  }
}
```

### 阶段 2：工具集成（1 天）

#### 任务 2.1：创建新的 SubagentTool

**文件**: `src/tools/subagent.ts`

**功能**:

- 替代现有的 `spawn.ts`
- 调用 `SubagentManager.spawn()`
- 返回友好的确认消息

**完整实现**:

```typescript
import { Tool } from './base';
import { RiskLevel } from './safety';
import { logger } from '../utils/logger';
import type { SubagentManager } from '../core/subagent/types';

export class SubagentTool extends Tool {
  name = 'subagent';

  description =
    'Spawn a subagent to handle a task in the background. Use this for complex or time-consuming tasks that can run independently. The subagent will complete the task and report back when done.';

  riskLevel = RiskLevel.HIGH;

  private manager: SubagentManager;
  private originChannel = 'cli';
  private originChatId = 'direct';
  private sessionKey = 'cli:direct';

  constructor(manager: SubagentManager) {
    super();
    this.manager = manager;
  }

  parameters = {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task for the subagent to complete',
      },
      label: {
        type: 'string',
        description: 'Optional short label for the task (for display)',
      },
    },
    required: ['task'],
  };

  setContext(channel: string, chatId: string): void {
    this.originChannel = channel;
    this.originChatId = chatId;
    this.sessionKey = `${channel}:${chatId}`;
  }

  async execute(params: { task: string; label?: string }): Promise<string> {
    const { task, label } = params;
    try {
      logger.info({ task, label }, 'Spawning subagent');

      const result = await this.manager.spawn(task, {
        label,
        originChannel: this.originChannel,
        originChatId: this.originChatId,
        sessionKey: this.sessionKey,
      });

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, task }, 'Subagent spawn failed');
      return `Error: Subagent spawn failed: ${msg}`;
    }
  }
}
```

#### 任务 2.2：标记 spawn.ts 为 deprecated

**文件**: `src/tools/spawn.ts`

**任务**: 添加废弃警告

```typescript
/**
 * @deprecated 请使用 SubagentTool 替代，功能更强大且支持任务跟踪
 */
export class SpawnTool extends Tool {
  // ... 现有代码 ...

  description = '⚠️ [DEPRECATED] 请使用 subagent 工具替代。生成一个后台进程来独立运行任务...';
}
```

#### 任务 2.3：更新工具注册表

**文件**: `src/tools/index.ts`

**任务**: 导出新的 `SubagentTool`

#### 任务 2.4：处理系统消息

**文件**: `src/core/agent.ts`

**任务**: 在 `_processMessage` 中处理来自 subagent 的系统消息

**修改**:

```typescript
private async _processMessage(msg: InboundMessage): Promise<OutboundMessage> {
  const { channel, chatId, content } = msg;
  const sessionKey = getSessionKey(msg);

  // 处理 subagent 结果消息
  if (channel === 'system' && content.includes('[Subagent')) {
    return await this.handleSubagentResult(msg);
  }

  // ... 现有逻辑 ...
}
```

### 阶段 3：双模式实现（2-3 天）

#### 任务 3.1：Embedded 模式实现

**文件**: `src/core/subagent/manager.ts`

**功能**:

- 在主进程内创建 `Queue` 和 `Worker`
- Worker 直接调用 `SubagentWorker`
- 共享内存空间

**实现**:

```typescript
private async initializeEmbeddedMode(): Promise<void> {
  const worker = new SubagentWorker({
    provider: this.config.provider,
    tools: this.config.tools,
    workspace: this.config.workspace,
    maxIterations: this.config.subagentConfig.maxIterations,
    timeout: this.config.subagentConfig.timeout,
  });

  this.taskWorker = new Worker('subagent-tasks', async (job) => {
    return await worker.execute(job.data);
  }, {
    embedded: true,
    concurrency: this.config.subagentConfig.concurrency,
  });

  logger.info('Subagent manager initialized in embedded mode');
}
```

#### 任务 3.2：Isolated 模式实现

**文件**: `src/core/subagent/manager.ts`

**功能**:

- 在主进程创建 `Queue`（embedded）
- Worker 进程通过 `fork()` 启动
- 共享 SQLite 数据文件（WAL 模式）
- 支持多 Worker 进程

**实现**:

```typescript
private async initializeIsolatedMode(): Promise<void> {
  const workerCount = this.config.subagentConfig.concurrency;

  for (let i = 0; i < workerCount; i++) {
    await this.startWorkerProcess(i);
  }

  logger.info(`Subagent manager initialized in isolated mode with ${workerCount} workers`);
}

private async startWorkerProcess(workerId: number): Promise<void> {
  const workerPath = fileURLToPath(
    new URL('../../cli/commands/subagent/start-worker.js', import.meta.url)
  );

  const child = fork(workerPath, [String(workerId)], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      DATA_PATH: this.config.subagentConfig.dataPath,
      SUBAGENT_MODE: 'isolated',
    },
  });

  // 监听进程退出
  child.on('exit', (code, signal) => {
    logger.warn({ workerId, code, signal }, 'Worker process exited');
    // 自动重启 worker
    setTimeout(() => this.startWorkerProcess(workerId), 5000);
  });

  logger.info({ workerId, pid: child.pid }, 'Worker process started');
}
```

#### 任务 3.3：Worker 进程启动器

**文件**: `src/cli/commands/subagent/start-worker.ts`

**功能**:

- 作为独立进程入口
- 连接到共享的 SQLite
- 启动 Worker 处理任务
- 优雅关闭处理

**完整实现**:

```typescript
import { Queue, Worker } from 'bunqueue/client';
import { logger } from '../../../utils/logger';
import { SubagentWorker } from '../../../core/subagent/worker';

const workerId = process.argv[2];
const dataPath = process.env.DATA_PATH || './data/bunqueue.db';

logger.info({ workerId, dataPath }, 'Starting subagent worker process');

// 创建子代理 worker 实例
const subagentWorker = new SubagentWorker({
  // ... 配置 ...
});

// 连接到共享队列
const queue = new Queue('subagent-tasks', {
  embedded: true,
  dataPath,
});

const worker = new Worker(
  'subagent-tasks',
  async job => {
    logger.info({ jobId: job.id }, 'Processing subagent job');
    const result = await subagentWorker.execute(job.data);
    logger.info({ jobId: job.id, status: result.status }, 'Job completed');
    return result;
  },
  {
    embedded: true,
    concurrency: 1, // 每个 worker 进程只处理一个任务
  },
);

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down worker');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down worker');
  await worker.close();
  process.exit(0);
});

logger.info('Subagent worker ready');
```

#### 任务 3.4：模式切换支持

**文件**: `src/core/subagent/manager.ts`

**功能**:

- 根据配置动态初始化
- 支持运行时查询当前模式

### 阶段 4：测试与文档（1-2 天）

#### 任务 4.1：单元测试

**文件**: `tests/unit/subagent/manager.test.ts`

**测试用例**:

- Manager 初始化（两种模式）
- spawn() 方法
- cancel() 方法
- 状态跟踪
- 结果处理

**文件**: `tests/unit/subagent/worker.test.ts`

**测试用例**:

- Worker 执行逻辑
- 工具集过滤
- 超时处理
- 错误处理

#### 任务 4.2：集成测试

**文件**: `tests/integration/subagent.test.ts`

**测试场景**:

- Embedded 模式：任务提交 → 执行 → 结果通知
- Isolated 模式：任务提交 → Worker 处理 → 结果通知
- 跨模式切换：切换模式后任务正常处理
- 任务取消功能

#### 任务 4.3：文档更新

**文件**: `README.md`, `README_CN.md`

**新增内容**:

- Subagent 功能说明
- 配置指南（两种模式）
- 使用示例
- 最佳实践
- 迁移指南（从 spawn 到 subagent）

## 📊 配置优先级规则

```
命令行参数 > 配置文件 > 默认值
```

示例：

```yaml
# config.yaml (配置文件)
subagent:
  enabled: true
  mode: embedded
  concurrency: 3
```

```bash
# 命令行参数（最高优先级）
bun dist/cli/run.js chat --subagent-mode isolated --subagent-concurrency 5

# 实际生效配置：
# - mode: isolated (命令行覆盖配置文件)
# - concurrency: 5 (命令行覆盖配置文件)
# - enabled: true (配置文件)
```

## 🔑 关键实现细节

### 1. 子代理工具集过滤

```typescript
// src/core/subagent/worker.ts
private buildFilteredToolSet(): ToolRegistry {
  const registry = new ToolRegistry();

  const allTools = this.tools.getAllTools();
  for (const [name, tool] of Object.entries(allTools)) {
    // 跳过 spawn 和 message 工具（避免无限递归）
    if (name === 'spawn' || name === 'message') {
      logger.debug(`Excluding tool from subagent: ${name}`);
      continue;
    }
    registry.register(tool);
  }

  return registry;
}
```

### 2. 任务 ID 生成

```typescript
// src/core/subagent/manager.ts
function generateTaskId(): string {
  // 8 位随机 ID
  return crypto.randomBytes(4).toString('hex');
}
```

### 3. 结果通知机制

```typescript
// src/core/subagent/manager.ts
private async handleResult(result: SubagentResult): Promise<void> {
  this.runningTasks.delete(result.taskId);

  const task = await this.getTaskById(result.taskId);
  const label = task?.label || result.taskId;
  const statusText = result.status === 'completed' ? 'completed successfully' : 'failed';

  const content = `[Subagent '${label}' ${statusText}]

Task: ${task?.task || result.taskId}

Result:
${result.result}

Summarize this naturally for the user. Keep it brief (1-2 sentences). Do not mention technical details like "subagent" or task IDs.`;

  await this.config.bus.publishInbound({
    channel: 'system',
    senderId: 'subagent',
    chatId: task?.originChatId || 'cli:direct',
    content,
  });
}
```

### 4. 数据持久化策略

```typescript
// src/core/subagent/manager.ts

// 任务完成后立即清理（配置策略：选项 A）
private async cleanupCompletedTask(taskId: string): Promise<void> {
  try {
    // 从队列中移除已完成的任务
    // bunqueue 会自动处理，但可以主动触发清理
    // 注意：只清理任务，不清理历史（如果需要审计）
  } catch (error) {
    logger.warn({ taskId, error }, 'Failed to cleanup task');
  }
}
```

## 📈 性能指标

基于 bunqueue 的性能数据：

| 模式     | 吞吐量       | 延迟 | 适用场景           |
| -------- | ------------ | ---- | ------------------ |
| Embedded | 286K ops/sec | <1ms | 个人助手、开发     |
| Isolated | 149K ops/sec | <5ms | 生产环境、高稳定性 |

## 🚀 后续扩展（方案 C 储备）

### 企业级需求清单

当需要企业级部署时，可以升级到 bunqueue TCP 模式：

- [ ] 多机分布式部署
- [ ] 高可用（HA）支持
- [ ] 自动故障转移
- [ ] 集群监控和告警
- [ ] S3 备份集成
- [ ] Prometheus + Grafana 监控

### 迁移路径

```
Embedded/Isolated → TCP Server 模式
1. 启动独立的 bunqueue server
2. 修改配置使用 TCP 连接
3. 部署多个 worker 进程
4. 配置负载均衡
5. 启用监控和告警
```

## 📝 实现检查清单

### 阶段 1：基础设施

- [ ] 安装 bunqueue 依赖
- [ ] 定义 SubagentConfigSchema
- [ ] 创建类型定义（types.ts）
- [ ] 实现 SubagentWorker 类
- [ ] 实现 SubagentManager 类
- [ ] 添加配置验证

### 阶段 2：工具集成

- [ ] 创建 SubagentTool
- [ ] 标记 spawn.ts 为 deprecated
- [ ] 更新工具注册表
- [ ] 处理系统消息
- [ ] 集成到 AgentLoop

### 阶段 3：双模式实现

- [ ] Embedded 模式初始化
- [ ] Isolated 模式初始化
- [ ] Worker 进程启动器
- [ ] 进程管理和重启
- [ ] 模式切换支持

### 阶段 4：测试与文档

- [ ] 单元测试（manager）
- [ ] 单元测试（worker）
- [ ] 集成测试
- [ ] 更新 README
- [ ] 更新 README_CN
- [ ] 添加使用示例

### 文档

- [ ] 架构设计文档
- [ ] API 文档
- [ ] 配置指南
- [ ] 故障排查指南

## 🎯 成功标准

完成所有任务后，系统应满足：

1. **功能完整性**：
   - ✅ 支持 subagent 任务的提交和执行
   - ✅ 支持 embedded 和 isolated 两种模式
   - ✅ 支持任务取消
   - ✅ 支持结果通知

2. **稳定性**：
   - ✅ 单元测试覆盖率 > 80%
   - ✅ 所有集成测试通过
   - ✅ 进程崩溃后自动恢复

3. **易用性**：
   - ✅ 清晰的配置文档
   - ✅ 完整的使用示例
   - ✅ 详细的错误消息

4. **性能**：
   - ✅ Embedded 模式吞吐量 > 100K ops/sec
   - ✅ Isolated 模式延迟 < 10ms

5. **可维护性**：
   - ✅ 代码结构清晰
   - ✅ 充分的注释
   - ✅ 完整的类型定义

## 📚 参考资料

- [bunqueue 文档](https://bunqueue.dev/)
- [bunqueue GitHub](https://github.com/egeominotti/bunqueue)
- [nanobot Python 版本](https://github.com/HKUDS/nanobot)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

**文档版本**: 1.0
**最后更新**: 2026-03-07
**作者**: Nanobot TypeScript Team
