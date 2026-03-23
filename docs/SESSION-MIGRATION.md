# Session 存储迁移指南

## 概述

已成功将 Session 存储从文件系统（JSONL）迁移到 **Drizzle ORM + SQLite**。

## 变更内容

### 1. 默认实现变更

```typescript
// 之前：使用文件系统存储
import { SessionManager } from '@nanobot/main';

// 现在：使用 SQLite 存储（API 完全兼容）
import { SessionManager } from '@nanobot/main';
```

**API 完全向后兼容，无需修改现有代码！**

### 2. 新增功能

#### 多渠道查询

```typescript
import { SessionManager } from '@nanobot/main';

const sessions = new SessionManager(workspace);

// 按渠道列出会话
const cliSessions = await sessions.listSessionsByChannel('cli');
const telegramSessions = await sessions.listSessionsByChannel('telegram');

// 按渠道和聊天ID查询
const session = await sessions.getOrCreateByChannel('telegram', '123456789');

// 获取活跃会话（N 天内有消息）
const activeSessions = await sessions.getActiveSessions(7);

// 获取渠道统计
const stats = await sessions.getChannelStats();
// [
//   { channel: 'cli', sessionCount: 10, messageCount: 150 },
//   { channel: 'telegram', sessionCount: 5, messageCount: 80 },
// ]
```

### 3. 数据库文件位置

```
workspace/
  └── sessions.db          # SQLite 数据库
  └── sessions.db-wal      # WAL 日志
  └── sessions.db-shm      # 共享内存
```

## 迁移步骤

### 选项 1：自动迁移（推荐）

首次运行时，DrizzleSessionManager 会自动创建数据库。现有的 JSONL 文件不受影响。

```bash
# 直接启动应用，SessionManager 会自动初始化数据库
bun run tui
```

### 选项 2：手动迁移数据

如果需要迁移现有的 JSONL 数据到 SQLite：

```typescript
import { FileSessionManager } from '@nanobot/main';
import { SessionManager } from '@nanobot/main';

// 1. 从文件系统读取
const fsManager = new FileSessionManager(workspace);
await fsManager.init();
const sessions = await fsManager.listSessions();

// 2. 写入 SQLite
const dbManager = new SessionManager(workspace);
await dbManager.init();

for (const sessionInfo of sessions) {
  const session = await fsManager.getOrCreate(sessionInfo.key);
  for (const message of session.messages) {
    await dbManager.addMessage(sessionInfo.key, message);
  }
}
```

### 选项 3：使用文件系统存储（如需回退）

如果需要继续使用文件系统存储：

```typescript
import { FileSessionManager } from '@nanobot/main';

const sessions = new FileSessionManager(workspace);
```

## 数据库管理

### 初始化数据库

```bash
bun run db:init ./workspace
```

### Schema 管理

```bash
# 生成迁移文件
bun run db:generate

# 推送 schema 到数据库
bun run db:push

# 打开 Drizzle Studio（可视化界面）
bun run db:studio
```

## 性能对比

| 指标 | 文件系统 | SQLite |
|------|---------|--------|
| 查询性能 | O(n) | O(log n) |
| 并发支持 | 文件锁 | ACID 事务 |
| 复杂查询 | 不支持 | SQL 支持 |
| 类型安全 | 运行时 | 编译时 + 运行时 |
| 数据完整性 | 文件系统 | 外键约束 |

## Schema 设计

### sessions 表

```sql
CREATE TABLE sessions (
  key TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  last_consolidated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### session_messages 表

```sql
CREATE TABLE session_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_key TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  message_id TEXT UNIQUE,
  parts TEXT,
  metadata TEXT,
  tool_calls TEXT,
  tool_call_id TEXT,
  model TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_key) REFERENCES sessions(key) ON DELETE CASCADE
);
```

## 注意事项

1. **并发安全**：SQLite 使用 WAL 模式，支持并发读，但写操作会串行化
2. **文件权限**：确保 workspace 目录有写入权限
3. **备份**：定期备份 `sessions.db` 文件
4. **迁移前备份**：迁移前建议备份现有的 JSONL 文件

## 故障排查

### 数据库锁定错误

如果遇到 "database is locked" 错误：

```typescript
// 确保只创建一个 SessionManager 实例
const sessions = new SessionManager(workspace);
await sessions.init();
```

### 类型错误

如果遇到 TypeScript 类型错误：

```bash
# 重新构建
bun run build
```

### 性能问题

对于大量会话（>10000），考虑添加索引：

```typescript
// 已自动添加以下索引：
// - sessions_channel_idx
// - sessions_chat_id_idx
// - sessions_updated_at_idx
// - session_messages_session_key_idx
// - session_messages_timestamp_idx
```

## 回滚

如需回滚到文件系统存储：

```typescript
// 在 packages/main/src/storage/session.ts 中修改导出
export { FileSessionManager as SessionManager } from './session-fs';
```

## 相关文件

- `packages/main/src/storage/session-drizzle.ts` - Drizzle ORM 实现
- `packages/main/src/storage/session-fs.ts` - 文件系统实现（已弃用）
- `packages/main/src/storage/schema/schema.ts` - 数据库 Schema
- `packages/main/src/storage/schema/init-db.ts` - 数据库初始化脚本
