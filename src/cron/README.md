# Cron 服务运行逻辑

## 概述

Cron 服务是一个基于文件持久化的定时任务调度系统，使用 **setTimeout 轮询机制** 实现任务的定时执行。它与消息总线（Bus）和 Agent 联动，支持在指定时间触发 AI 对话。

## 核心组件

```typescript
class CronService {
  private store: CronStore | null = null;        // 任务存储（从文件加载）
  private timer: setTimeout | null = null;       // 当前激活的定时器
  private running = false;                        // 运行状态
}
```

## 运行流程

### 1️⃣ 启动阶段 (`start()`)

```typescript
async start() {
  this.running = true;
  await this.loadStore();                    // 从 cron.json 加载任务
  for (const job of jobs) {
    if (job.enabled && !job.state.nextRunAtMs) {
      // 计算下次运行时间
      job.state.nextRunAtMs = await computeNextRun(job.schedule, now);
    }
  }
  this.armTimer();                           // 设置定时器
}
```

**初始化步骤**：
1. 从 `cron.json` 加载已保存的任务
2. 为没有 `nextRunAtMs` 的任务计算下次执行时间
3. 启动定时器

### 2️⃣ 定时器唤醒 (`armTimer()`)

```typescript
private armTimer() {
  const next = this.getNextWakeMs();        // 获取所有任务中最早的执行时间
  const delay = Math.max(0, next - nowMs()); // 计算延迟
  this.timer = setTimeout(() => {
    this.onTimer();                         // 到期后执行
  }, delay);
}
```

**关键设计**：
- 只设置**一个全局定时器**，指向最近的下一个任务
- 避免了为每个任务创建定时器的资源浪费

### 3️⃣ 执行到期任务 (`onTimer()`)

```typescript
private async onTimer() {
  const now = nowMs();
  const due = jobs.filter(j =>
    j.enabled && now >= j.state.nextRunAtMs  // 找出所有到期任务
  );
  for (const job of due) {
    await this.executeJob(job);              // 逐个执行
  }
  await this.saveStore();                    // 保存状态
  this.armTimer();                           // 重新设置定时器
}
```

**执行流程**：
1. 找出所有到期的任务（可能有多个同时到期）
2. 逐个执行任务
3. 保存更新后的状态到文件
4. 重新设置定时器，指向下一个任务

### 4️⃣ 执行单个任务 (`executeJob()`)

```typescript
private async executeJob(job: CronJob) {
  const start = nowMs();
  try {
    // 1. 调用 onJob 回调（publishInbound 到 Bus）
    if (this.onJob) {
      await this.onJob(job);
    }
    job.state.lastStatus = 'ok';
  } catch (err) {
    job.state.lastStatus = 'error';
    job.state.lastError = err.message;
  }

  // 2. 更新执行时间
  job.state.lastRunAtMs = start;

  // 3. 根据调度类型处理：
  if (job.schedule.kind === 'at') {
    // 一次性任务：删除或禁用
    if (job.deleteAfterRun) {
      store.jobs = store.jobs.filter(j => j.id !== job.id);
    } else {
      job.enabled = false;
      job.state.nextRunAtMs = null;
    }
  } else {
    // 周期性任务：计算下一次运行时间
    job.state.nextRunAtMs = await computeNextRun(job.schedule, nowMs());
  }
}
```

## 调度类型

```typescript
type CronSchedule =
  | { kind: 'at'; atMs: number }           // 指定时间戳执行一次
  | { kind: 'every'; everyMs: number }     // 每隔 N 毫秒执行
  | { kind: 'cron'; expr: string; tz?: string } // cron 表达式（使用 croner 库）
```

### at - 一次性定时任务

```typescript
{ kind: 'at', atMs: 1234567890000 }
```

- 在指定时间戳执行一次
- 执行后根据 `deleteAfterRun` 决定是否删除或禁用

### every - 固定间隔任务

```typescript
{ kind: 'every', everyMs: 60000 }  // 每分钟执行
```

- 每隔固定毫秒数执行一次
- 执行后更新 `nextRunAtMs = now + everyMs`

### cron - Cron 表达式

```typescript
{ kind: 'cron', expr: '0 9 * * 1-5', tz: 'Asia/Shanghai' }
```

- 使用标准 cron 表达式
- 支持时区参数（使用 `croner` 库）
- 执行后计算下一个匹配的时间点

## 持久化机制

```
cron.json (文件)
    ↓
loadStore() → 解析 JSON → 内存 store
    ↓
addJob/removeJob/executeJob → 修改 store
    ↓
saveStore() → 写入文件
```

**文件格式**：
```json
{
  "version": 1,
  "jobs": [
    {
      "id": "abc123",
      "name": "daily report",
      "enabled": true,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * 1-5"
      },
      "payload": {
        "kind": "agent_turn",
        "message": "生成日报",
        "deliver": false,
        "channel": null,
        "to": null
      },
      "state": {
        "nextRunAtMs": 1234567890000,
        "lastRunAtMs": 1234560000000,
        "lastStatus": "ok",
        "lastError": null
      },
      "createdAtMs": 1234500000000,
      "updatedAtMs": 1234567890000,
      "deleteAfterRun": false
    }
  ]
}
```

## 设计亮点

### 1. 单定时器模式

不是每个任务一个 `setTimeout`，而是全局一个，资源高效：

```typescript
// ❌ 不推荐：每个任务一个定时器
jobs.forEach(job => {
  setTimeout(() => executeJob(job), job.delay);
});

// ✅ 推荐：全局一个定时器
const nextDelay = Math.min(...jobs.map(j => j.delay));
setTimeout(() => onTimer(), nextDelay);
```

### 2. 容错恢复

重启后从文件恢复任务状态：
- 任务不会丢失
- 执行历史保留
- 下次运行时间已计算

### 3. 时区支持

cron 表达式支持 `tz` 参数：

```typescript
{ kind: 'cron', expr: '0 9 * * *', tz: 'Asia/Shanghai' }
```

### 4. 删除标志

`deleteAfterRun` 控制一次性任务执行后的行为：
- `true`: 执行后从列表中删除
- `false`: 执行后禁用（`enabled = false`），但保留记录

### 5. 状态跟踪

每个任务记录完整的执行状态：
- `lastStatus`: `'ok'` | `'error'` | `null`
- `lastError`: 错误信息
- `lastRunAtMs`: 最后执行时间
- `nextRunAtMs`: 下次执行时间

## 与 Bus/Agent 的联动

```typescript
// 在 setup.ts 中初始化
const cronService = new CronService({
  storePath: path.join(workspace, 'cron.json'),
  onJob: async (job) => {
    // 将定时任务的消息发布到 inbound 队列
    await bus.publishInbound({
      channel: job.payload.channel || 'cli',
      chatId: 'cron',
      content: job.payload.message,
      timestamp: new Date(),
      senderId: `cron:${job.id}`,
    });
  },
});

await cronService.start();
```

**联动流程**：
```
定时任务到期
    ↓
onJob 回调触发
    ↓
publishInbound 发布消息
    ↓
AgentLoop.consumeInbound() 消费消息
    ↓
Agent 处理并生成响应
    ↓
publishOutbound 发布回复
```

## 完整流程图

```
addJob() 添加任务
    ↓
computeNextRun() 计算下次执行时间
    ↓
保存到 cron.json
    ↓
armTimer() 设置 setTimeout(delay)
    ↓
到期 → onTimer() → executeJob()
    ↓
执行 onJob 回调 (publishInbound)
    ↓
根据 schedule.kind 处理：
  at → 删除/禁用
  every → 重新计算 now + everyMs
  cron → croner.nextRun()
    ↓
更新状态并保存
    ↓
重新 armTimer()
```

## API 方法

### start()
启动 Cron 服务，加载任务并设置定时器。

### stop()
停止服务，清除定时器。

### listJobs(includeDisabled)
列出所有任务，可选择是否包含已禁用的任务。

### addJob(opts)
添加新的定时任务：
```typescript
await cronService.addJob({
  name: '每日晨报',
  schedule: { kind: 'cron', expr: '0 8 * * *', tz: 'Asia/Shanghai' },
  message: '生成今日工作计划',
  deliver: false,
  channel: 'cli',
  to: null,
  deleteAfterRun: false,
});
```

### removeJob(jobId)
删除指定 ID 的任务。

## 使用示例

```typescript
// 创建定时任务：每个工作日早上 9 点提醒
await cronService.addJob({
  name: 'workday_reminder',
  schedule: {
    kind: 'cron',
    expr: '0 9 * * 1-5',
    tz: 'Asia/Shanghai'
  },
  message: '早上好！新的一天开始了',
  deliver: false,
  channel: 'cli',
  to: null,
  deleteAfterRun: false,
});

// 创建一次性任务：5分钟后提醒
await cronService.addJob({
  name: 'reminder_5min',
  schedule: {
    kind: 'at',
    atMs: Date.now() + 5 * 60 * 1000
  },
  message: '5分钟到了',
  deliver: false,
  channel: 'cli',
  to: null,
  deleteAfterRun: true,  // 执行后删除
});

// 创建周期性任务：每10分钟检查一次
await cronService.addJob({
  name: 'health_check',
  schedule: {
    kind: 'every',
    everyMs: 10 * 60 * 1000
  },
  message: '/status',
  deliver: false,
  channel: 'cli',
  to: null,
  deleteAfterRun: false,
});
```
