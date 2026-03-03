# Slash Command 架构

独立的 Slash 命令执行系统，用于处理 TUI 中的斜杠命令（如 `/new`、`/help` 等）。

**设计理念：Handler 是命令的唯一数据源**，所有命令信息（id、label、description）都由 Handler 定义，自动生成命令列表。

## 架构设计

```
Handler 定义元数据 (id, label, description)
    ↓
SlashCommandExecutor 注册所有 Handlers
    ↓
getSlashCommandOptions() 自动生成命令列表
    ↓
ChatInput 使用命令列表
    ↓
用户选择命令
    ↓
execute(commandId, context)
    ↓
具体 Handler.execute()
```

## 文件结构

```
commands/
├── index.ts                 # 统一导出
├── types.ts                 # 类型定义
├── SlashCommandExecutor.ts  # 命令执行器
├── README.md                # 本文档
└── handlers/
    ├── index.ts             # 处理器注册表
    ├── NewSessionHandler.ts # /new 命令 ✅
    ├── StatusHandler.ts     # /status 命令 ✅
    ├── HelpHandler.ts       # /help 命令 ✅
    ├── ModelsHandler.ts     # /models 命令 ✅
    ├── ThemesHandler.ts     # /themes 命令 ✅
    ├── SessionsHandler.ts   # /sessions 命令 ✅
    ├── InitHandler.ts       # /init 命令 ⏳（空实现）
    ├── McpsHandler.ts       # /mcps 命令 ⏳（空实现）
    ├── ReviewHandler.ts     # /review 命令 ⏳（空实现）
    └── SkillsHandler.ts     # /skills 命令 ⏳（空实现）
```

## 核心接口

### SlashCommandHandler

命令处理器接口，**Handler 是命令的唯一数据源**：

```typescript
interface SlashCommandHandler {
  id: string;                    // 命令 ID
  label: string;                 // 命令标签（如 "/new"）
  description: string;           // 命令描述
  category?: SlashCommandCategory; // 命令分类（可选）

  execute(context: SlashCommandContext): Promise<void> | void;
}
```

**图例**：✅ 已实现  ⏳ 未实现（空实现）

### SlashCommandContext

命令执行上下文，提供所有必要的上下文信息：

```typescript
interface SlashCommandContext {
  runtime: AgentRuntime | null;           // Agent 运行时
  config: Config | null;                  // 配置对象
  navigateTo: (view: ViewMode) => void;    // 导航方法
  setMessages: Dispatch<...>;              // 设置消息列表
  clearMessages: () => void;               // 清空消息
  addSystemMessage: (content: string) => void;  // 添加系统消息
  addUserMessage: (content: string) => void;    // 添加用户消息
  addAssistantMessage: (content: string) => void; // 添加助手消息
}
```

## SlashCommandExecutor

命令执行器，负责管理和执行所有命令：

```typescript
class SlashCommandExecutor {
  register(handler: SlashCommandHandler): void;           // 注册单个处理器
  registerAll(handlers: SlashCommandHandler[]): void;     // 批量注册
  execute(commandId: string, context: SlashCommandContext): Promise<boolean>;

  // 获取所有命令的元数据，自动生成 SlashCommandOption 数组
  getSlashCommandOptions(): Array<{
    id: string;
    label: string;
    description: string;
  }>;
}
```

## 使用方式

### 1. 在组件中使用（GatewayApp）

```typescript
import { SlashCommandExecutor, createAllHandlers } from '../commands';

export function GatewayApp() {
  // 创建执行器并获取命令列表
  const slashExecutor = useMemo(() => {
    const executor = new SlashCommandExecutor();
    executor.registerAll(createAllHandlers());
    return executor;
  }, []);

  // 从 Handler 元数据生成命令列表
  const slashCommands = useMemo(() =>
    slashExecutor.getSlashCommandOptions(),
    [slashExecutor]
  );

  // 处理命令
  const handleSlashCommand = async (commandId: string) => {
    const context = {
      runtime,
      config,
      navigateTo,
      setMessages,
      clearMessages: () => setMessages([]),
      addSystemMessage: (content) => { /* ... */ },
      addUserMessage: (content) => { /* ... */ },
      addAssistantMessage: (content) => { /* ... */ },
    };

    await slashExecutor.execute(commandId, context);
  };

  return (
    <ChatInput
      slashCommands={slashCommands}
      onSlashCommand={handleSlashCommand}
    />
  );
}
```

### 2. 添加新命令

#### 步骤 1：创建 Handler

```typescript
// commands/handlers/MyCommandHandler.ts
import type { SlashCommandHandler, SlashCommandContext } from '../types';

export class MyCommandHandler implements SlashCommandHandler {
  id = 'mycommand';              // 命令 ID
  label = '/mycommand';          // 显示标签
  description = 'My command';    // 描述
  category = 'chat' as const;    // 分类

  async execute(context: SlashCommandContext): Promise<void> {
    const { runtime, addSystemMessage } = context;

    // 实现命令逻辑
    addSystemMessage('执行 mycommand...');
  }
}
```

#### 步骤 2：注册到工厂函数

```typescript
// commands/handlers/index.ts
import { MyCommandHandler } from './MyCommandHandler';

export function createAllHandlers(): SlashCommandHandler[] {
  return [
    // ...其他处理器
    new MyCommandHandler(),
  ];
}
```

#### 步骤 3：完成！无需修改其他文件

- ✅ 命令自动出现在 ChatInput 列表中
- ✅ 无需修改 `constants.ts`（已废弃）
- ✅ 无需修改 ChatInput
- ✅ 单一数据源，不会出现不一致

## 已实现的命令

| 命令 | Handler | 状态 | 功能 |
|------|---------|------|------|
| `/new` | NewSessionHandler | ✅ | 开启新会话，归档当前历史 |
| `/help` | HelpHandler | ✅ | 显示帮助信息 |
| `/status` | StatusHandler | ✅ | 跳转到状态页面 |
| `/models` | ModelsHandler | ✅ | 跳转到配置页面（模型） |
| `/themes` | ThemesHandler | ✅ | 跳转到配置页面（主题） |
| `/sessions` | SessionsHandler | ✅ | 跳转到状态页面（会话） |
| `/init` | InitHandler | ⏳ | 未实现，execute 空实现 |
| `/mcps` | McpsHandler | ⏳ | 未实现，execute 空实现 |
| `/review` | ReviewHandler | ⏳ | 未实现，execute 空实现 |
| `/skills` | SkillsHandler | ⏳ | 未实现，execute 空实现 |

## 设计优势

### 1. 单一数据源

- Handler 定义所有命令元数据
- 自动生成命令列表
- **无需手动同步**，不会出现不一致

### 2. 可扩展

- 新增命令只需添加 Handler
- **无需修改** constants.ts、ChatInput、GatewayApp
- 命令自动出现在 UI 中

### 3. 可测试

- 每个 Handler 独立
- 易于单元测试
- Mock context 即可测试

### 4. 类型安全

- 统一的 Context 接口
- 编译时检查
- IDE 自动补全

### 5. 元数据驱动

- 命令信息与代码在同一位置
- 减少上下文切换
- 易于维护

## 迁移说明

### 旧方式（已废弃）

```typescript
// constants.ts - 手动维护命令列表 ❌
export const SLASH_COMMANDS: SlashCommandOption[] = [
  { id: 'new', label: '/new', description: 'New session' },
  // ... 需要手动保持同步
];
```

### 新方式（元数据驱动）

```typescript
// Handler 定义一切 ✅
export class NewSessionHandler implements SlashCommandHandler {
  id = 'new';
  label = '/new';
  description = 'New session';

  async execute(context: SlashCommandContext) { /* ... */ }
}

// 自动生成命令列表
const commands = executor.getSlashCommandOptions();
```

## 错误处理

执行器会自动捕获命令执行中的错误：

```typescript
try {
  await handler.execute(context);
  return true;
} catch (error) {
  console.error(`Error executing slash command "${commandId}":`, error);
  context.addSystemMessage(`执行命令失败: ${error.message}`);
  return false;
}
```

## 注意事项

1. **Context 的生命周期**：Context 对象每次命令执行时创建，不要长期持有引用
2. **异步操作**：Handler 的 `execute` 方法支持异步，使用 `async/await`
3. **未实现命令**：execute 空实现即可，命令会显示但不会执行任何操作
4. **命令 ID 匹配**：Handler 的 `id` 必须唯一，用于内部标识
