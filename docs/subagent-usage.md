# Subagent 使用指南

## 概述

nanobot-ts 现在支持基于 `bunqueue` 的 Subagent 系统，允许主代理在后台执行复杂或耗时的任务。

## 特性

- **两种运行模式**：
  - `embedded`（默认）：队列和 worker 在同一进程内运行
  - `isolated`：worker 进程独立运行，进程隔离
- **任务跟踪**：实时跟踪子代理任务状态
- **结果通知**：任务完成后自动通知主代理
- **工具过滤**：子代理自动排除 spawn 和 message 工具，避免无限递归
- **持久化**：任务状态自动保存到 SQLite 数据库

## 配置

在配置文件中添加 subagent 配置：

```json
{
  "tools": {
    "subagent": {
      "enabled": true,
      "mode": "embedded",
      "concurrency": 3,
      "maxIterations": 15,
      "timeout": 300,
      "dataPath": "./data/bunqueue.db"
    }
  }
}
```

### 配置说明

- `enabled`：是否启用 subagent（默认：true）
- `mode`：执行模式，`embedded` 或 `isolated`（默认：embedded）
- `concurrency`：最大并发数（默认：3）
- `maxIterations`：子代理最大迭代次数（默认：15）
- `timeout`：子代理超时时间（秒）（默认：300）
- `dataPath`：bunqueue 数据路径（默认：./data/bunqueue.db）

### 配置优先级

`CLI args > config file > defaults`

## 使用示例

### 1. 启用 Subagent

**方式一：通过配置文件**

编辑 `~/.nanobot/config.json`：

```json
{
  "tools": {
    "subagent": {
      "enabled": true,
      "mode": "embedded"
    }
  }
}
```

**方式二：通过 CLI 命令**

```bash
# 启用 subagent
nanobot-ts config set tools.subagent.enabled true

# 设置运行模式为 isolated
nanobot-ts config set tools.subagent.mode isolated
```

### 2. 如何触发 Subagent

Subagent 工具会由 AI 自动触发，你也可以明确要求使用：

```bash
# 启动 gateway
nanobot-ts gateway
```

**示例对话 1：自动触发**

```
User: 分析这个项目的代码，找出所有潜在的安全问题
Bot: 我会使用 subagent 工具在后台分析代码...

[背景执行]

User: 分析完成了吗？
Bot: 已完成，发现以下安全问题：
1. 命令注入风险
2. SQL 注入漏洞
3. 未验证的输入
```

**示例对话 2：明确要求**

```
User: 使用 subagent 来运行项目测试
Bot: 我会使用 subagent 工具来执行测试...

[背景执行]

Bot: 测试完成，所有测试通过！
```

### 3. 任务结果通知

任务完成后，subagent 结果会通过 MessageBus 通知主代理：

```
[Subagent 'code-analysis' completed successfully]

Task: Analyze project code for security issues

Result:
Found 3 security issues:
1. Command injection risk in exec tool
2. SQL injection vulnerability in database queries
3. Unvalidated user input

Bot: I've completed the security analysis. Found 3 potential issues:
1. Command injection risks in tool execution
2. SQL injection vulnerabilities
3. Unvalidated user input
```

## 运行模式对比

### Embedded 模式（默认）

```json
{
  "tools": {
    "subagent": {
      "mode": "embedded"
    }
  }
}
```

**性能**：286K ops/sec（无进程间通信开销）

**优点**：

- ✅ 最高性能
- ✅ 内存共享，无需序列化
- ✅ 部署简单，无需额外配置
- ✅ 更低的内存占用

**缺点**：

- ⚠️ 子代理崩溃可能影响主进程
- ⚠️ 适合单机部署

**适用场景**：个人助手、开发环境、单机部署

### Isolated 模式

```json
{
  "tools": {
    "subagent": {
      "mode": "isolated"
    }
  }
}
```

**性能**：149K ops/sec（进程隔离，有 IPC 开销）

**优点**：

- ✅ 进程隔离，子代理崩溃不影响主进程
- ✅ 更好的稳定性
- ✅ 支持水平扩展（多个 worker 进程）
- ✅ 自动重启失败的 worker 进程

**缺点**：

- ⚠️ 需要共享 SQLite 数据库
- ⚠️ 有进程间通信开销
- ⚠️ 较高的内存占用

**适用场景**：生产环境、高稳定性要求、需要进程隔离

## 从 spawn 工具迁移

旧的 `spawn` 工具已标记为废弃。建议迁移到新的 `subagent` 工具：

**主要区别**：

| 特性     | spawn（已废弃） | subagent（推荐）         |
| -------- | --------------- | ------------------------ |
| 架构     | 简单后台执行    | 基于 bunqueue 的任务队列 |
| 性能     | 一般            | 高性能（286K ops/sec）   |
| 可靠性   | 无持久化        | SQLite WAL 持久化        |
| 扩展性   | 单进程          | 支持并发和水平扩展       |
| 工具过滤 | 无              | 自动排除危险工具         |

**迁移示例**：

```
# 旧方式（已废弃）
User: 运行构建并检查错误
Bot: [使用 spawn 工具]
正在运行 npm run build...

# 新方式（推荐）
User: 运行构建并检查错误
Bot: 我会使用 subagent 工具在后台执行构建...

[任务加入队列，并发执行]

Bot: 构建完成，发现 2 个警告
```

## 监控和调试

### 查看任务状态

subagent 系统会记录详细的日志：

```bash
# 查看最新日志
nanobot-ts logs

# 查看更多日志行
nanobot-ts logs --tail 100

# 实时监控日志
tail -f ~/.nanobot/logs/*.log
```

### 查看数据库

```bash
# 查看所有 subagent 任务
sqlite3 ./data/bunqueue.db "SELECT * FROM jobs WHERE queue = 'subagent-tasks';"

# 查看待处理任务
sqlite3 ./data/bunqueue.db "SELECT * FROM jobs WHERE queue = 'subagent-tasks' AND status = 'pending';"

# 查看已完成的任务
sqlite3 ./data/bunqueue.db "SELECT * FROM jobs WHERE queue = 'subagent-tasks' AND status = 'completed';"
```

### 检查 Worker 状态

```bash
# Embedded 模式：检查主进程日志
nanobot-ts logs

# Isolated 模式：检查 worker 进程
ps aux | grep start-worker
```

### 取消任务

可以通过主代理取消正在运行的任务：

```
User: 取消正在运行的代码分析任务
Bot: 已取消任务 "code-analysis"
```

## 故障排查

### 问题：任务卡在 pending 状态

**解决方案**：检查 worker 是否正常运行

```bash
# Embedded 模式：检查主进程日志
nanobot-ts logs

# Isolated 模式：检查 worker 进程
ps aux | grep start-worker

# 如果 worker 没有运行，重启 gateway
nanobot-ts gateway
```

### 问题：任务失败但无详细错误

**解决方案**：启用调试日志

```bash
# 设置环境变量启用调试日志
LOG_LEVEL=debug nanobot-ts gateway

# 查看详细日志
nanobot-ts logs --tail 50
```

### 问题：Isolated 模式下 worker 启动失败

**解决方案**：检查数据路径和文件权限

```bash
# 检查数据目录
ls -la ./data/

# 确保 bunqueue.db 可写
chmod 666 ./data/bunqueue.db

# 检查配置中的 dataPath 是否正确
nanobot-ts config get tools.subagent.dataPath
```

### 问题：subagent 工具不可用

**解决方案**：确认 subagent 已启用

```bash
# 检查 subagent 是否启用
nanobot-ts config get tools.subagent.enabled

# 启用 subagent
nanobot-ts config set tools.subagent.enabled true

# 重新启动 gateway
nanobot-ts gateway
```

## 性能调优

### 调整并发数

```bash
# 增加并发数（根据 CPU 核心数调整）
nanobot-ts config set tools.subagent.concurrency 5
```

**建议**：不要超过 CPU 核心数的 2 倍

### 调整超时时间

```bash
# 增加超时到 10 分钟（600 秒）
nanobot-ts config set tools.subagent.timeout 600
```

### 调整迭代次数

```bash
# 允许更多 LLM 迭代
nanobot-ts config set tools.subagent.maxIterations 20
```

## 最佳实践

### 1. 选择合适的运行模式

- **开发/个人使用**：`embedded` 模式（更高性能，更低资源占用）
- **生产环境**：`isolated` 模式（进程隔离，更稳定）

### 2. 合理设置并发数

- 不要超过 CPU 核心数的 2 倍
- 默认 3 适合大多数场景
- 根据任务类型调整：CPU 密集型任务使用较低并发，I/O 密集型任务可以使用较高并发

### 3. 监控任务执行

- 定期检查任务状态
- 查看失败任务并分析原因
- 监控数据库大小，避免膨胀

### 4. 优化超时时间

- 根据任务复杂度调整超时时间
- 简单任务：60-180 秒
- 复杂任务：300-600 秒
- 避免设置过长的超时时间，以免资源浪费

### 5. 工具过滤策略

- Subagent 自动排除 `spawn` 和 `message` 工具，防止无限递归
- 如需自定义工具过滤，修改 worker 配置

### 6. 任务持久化策略

- 系统只会持久化正在运行的任务
- 已完成任务和失败任务会自动清理
- 定期检查数据库大小，必要时手动清理

## 高级用法

### 自定义 Worker 进程

在 `isolated` 模式下，可以自定义 worker 启动逻辑：

```typescript
// src/cli/commands/subagent/start-worker.ts
// 修改此文件以自定义 worker 行为
```

### 集成到现有系统

```typescript
import { SubagentManager } from '../core/subagent';
import { SubagentTool } from '../tools/subagent';

// 创建 SubagentManager
const subagentManager = new SubagentManager(config);

// 初始化
await subagentManager.initialize();

// 创建 SubagentTool 并设置 manager
const subagentTool = new SubagentTool();
subagentTool.setManager(subagentManager);

// 注册到工具表
tools.register(subagentTool);
```

### 扩展 Subagent 功能

可以通过继承和扩展 subagent 功能来满足特定需求：

```typescript
import { SubagentTool } from '../tools/subagent';

class CustomSubagentTool extends SubagentTool {
  // 自定义任务处理逻辑
  async execute(params: any) {
    // 自定义实现
  }
}
```

## 参考资料

- [bunqueue 文档](https://bunqueue.dev/)
- [Subagent 实现计划](./subagent-implementation.md)
- [Subagent 特性清单](./subagent-feature-checklist.md)
- [Subagent 最终验证报告](./subagent-full-final-verification.md)
- [nanobot Python 版本](https://github.com/HKUDS/nanobot)
- [Vercel AI SDK 文档](https://sdk.vercel.ai/)

## 常见问题

### Q: Subagent 和 spawn 有什么区别？

A: Subagent 基于 bunqueue 任务队列系统，具有更好的性能、可靠性和扩展性。spawn 工具已被标记为废弃。

### Q: 如何在运行时切换模式？

A: 使用 CLI 命令修改配置：

```bash
nanobot-ts config set tools.subagent.mode isolated
# 然后重启 gateway
nanobot-ts gateway
```

### Q: Subagent 任务的性能如何？

A:

- Embedded 模式：286K ops/sec
- Isolated 模式：149K ops/sec

### Q: 如何查看正在运行的 Subagent 任务？

A: 使用 SQLite 查询：

```bash
sqlite3 ./data/bunqueue.db "SELECT * FROM jobs WHERE queue = 'subagent-tasks' AND status = 'running';"
```

---

**文档版本**: 2.0
**最后更新**: 2026-03-07
