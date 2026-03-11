# Nanobot-TS Monorepo 迁移指南

## 已完成的工作

### 1. 基础设施搭建 ✅

- ✅ 配置 Bun workspaces
- ✅ 创建所有包的目录结构
- ✅ 配置 TypeScript paths 映射
- ✅ 配置构建工具
- ✅ 成功构建基础包（shared, logger, utils）

### 2. 包结构

```
packages/
├── shared/         # 共享类型和配置 ✅ 已构建
├── logger/         # 日志工具 ✅ 已构建
├── utils/          # 工具函数 ✅ 已构建
├── main/           # 核心框架（Agent, Memory, Approval）
├── providers/      # LLM 提供商
├── tools/          # AI 工具集合
├── channels/       # 消息渠道集合
├── cli/            # 命令行工具
├── tui/            # 终端交互界面
├── server/         # HTTP 服务器
├── skills/         # 技能加载器
└── mcp/            # Model Context Protocol 支持
```

### 3. 依赖关系

```
cli ──┬──> main
      ├──> tools
      ├──> channels
      ├──> utils
      └──> logger

tui ──> main
      └──> logger

server ──> main
          ├──> channels (可选)
          └──> tools (可选)

main ──┬──> shared
      ├──> logger
      ├──> utils
      ├──> channels (可选)
      └──> tools (可选)

tools ──┬──> shared
          └──> logger

channels ──┬──> shared
            └──> logger

providers ──┬──> shared
              └──> logger

skills ──┬──> shared
          └──> logger

mcp ──┬──> shared
       └──> logger

shared ──> 无依赖

logger ──> 无依赖

utils ──> 无依赖
```

## 后续迁移步骤

### 阶段一：核心包代码迁移

#### 1. 迁移 @nanobot/main

需要迁移的目录：

- `src/core/*` → `packages/main/src/core/`
- `src/storage/*` → `packages/main/src/storage/`
- `src/bus/*` → `packages/main/src/bus/`
- `src/cron/*` → `packages/main/src/cron/`
- `src/mcp/*` → `packages/mcp/src/` （注意：MCP 应该迁移到独立的 mcp 包）

步骤：

1. 复制文件到对应目录
2. 更新导入路径：
   - `@/config` → `@nanobot/shared`
   - `@/utils/logger` → `@nanobot/logger`
   - `@/utils/*` → `@nanobot/utils`
3. 测试构建

#### 2. 迁移 @nanobot/providers

需要迁移的目录：

- `src/providers/*` → `packages/providers/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

#### 3. 迁移 @nanobot/tools

需要迁移的目录：

- `src/tools/*` → `packages/tools/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

#### 4. 迁移 @nanobot/channels

需要迁移的目录：

- `src/channels/*` → `packages/channels/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

#### 5. 迁移 @nanobot/mcp

需要迁移的目录：

- `src/mcp/*` → `packages/mcp/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

#### 6. 迁移 @nanobot/skills

需要迁移的目录：

- `src/skills/*` → `packages/skills/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

### 阶段二：应用包代码迁移

#### 1. 迁移 @nanobot/cli

需要迁移的目录：

- `src/cli/*` → `packages/cli/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 更新 `packages/cli/src/run.ts` 的入口点
4. 测试构建

#### 2. 迁移 @nanobot/tui

需要迁移的目录：

- `src/cli/tui/*` → `packages/tui/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

#### 3. 迁移 @nanobot/server

需要迁移的目录：

- `src/server/*` → `packages/server/src/`

步骤：

1. 复制文件到对应目录
2. 更新导入路径
3. 测试构建

### 阶段三：验证和测试

1. 运行 `bun run build` 构建所有包
2. 运行 `bun run typecheck` 进行类型检查
3. 运行 `bun run lint` 进行代码检查
4. 测试 CLI 功能：`bun packages/cli/dist/run.js --help`
5. 测试各个模块的功能

### 阶段四：清理和优化

1. 验证所有功能正常后，删除 `src/` 目录
2. 更新文档
3. 优化依赖关系
4. 配置 CI/CD

## 重要注意事项

1. **不要修改 src 目录**：等待所有迁移完成后再删除
2. **逐步迁移**：每次迁移一个包，确保构建成功后再继续
3. **更新导入路径**：所有 `@/` 开头的导入都需要更新为对应的包名
4. **测试每个阶段**：确保每个阶段的功能正常

## 导入路径映射

| 旧路径           | 新路径               |
| ---------------- | -------------------- |
| `@/config`       | `@nanobot/shared`    |
| `@/utils/logger` | `@nanobot/logger`    |
| `@/utils/*`      | `@nanobot/utils`     |
| `@/core`         | `@nanobot/main/core` |
| `@/tools`        | `@nanobot/tools`     |
| `@/channels`     | `@nanobot/channels`  |
| `@/providers`    | `@nanobot/providers` |

## 构建命令

```bash
# 构建所有包
bun run build

# 构建单个包
cd packages/<package-name> && bun run build

# 类型检查
bun run typecheck

# 清理构建产物
bun run clean

# 开发模式（监听文件变化）
bun run dev
```
