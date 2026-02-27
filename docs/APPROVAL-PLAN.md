人机交互机制方案：

## 📐 完整实施计划

### 一、核心架构设计

#### 1. 工具风险级别定义
```typescript
// 新增文件: src/tools/safety.ts
export enum RiskLevel {
  LOW = 'low',      // 文件读取、web搜索 - 无需确认
  MEDIUM = 'medium', // 文件写入、定时任务 - 首次确认
  HIGH = 'high',     // shell执行、spawn - 总是确认
}
```

#### 2. 确认管理器接口
```typescript
// 新增文件: src/core/approval.ts
export interface ApprovalManager {
  // 检查是否需要确认
  needsApproval(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): Promise<boolean>;
  
  // 请求用户确认
  requestApproval(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): Promise<boolean>;
  
  // 记录确认历史（会话级记忆）
  recordApproval(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): void;
}
```

#### 3. 不同渠道的确认策略
- **CLI渠道**: 使用inquirer交互式确认
- **消息渠道**: 发送确认消息，等待"yes"/"no"回复
- **会话记忆**: 5分钟内重复操作自动确认

### 二、代码修改清单

#### **新增文件** (7个)
```
src/tools/safety.ts                    # 工具安全级别定义
src/core/approval.ts                   # 确认管理器核心
src/core/approval-handlers/cli.ts      # CLI确认处理器
src/core/approval-handlers/message.ts  # 消息确认处理器
src/core/approval-handlers/memory.ts   # 会话记忆管理
src/core/approval-handlers/index.ts    # 确认处理器导出
src/config/approval-schema.ts          # 确认配置Schema
```

#### **修改文件** (7个)
```
src/tools/base.ts                      # 添加riskLevel属性
src/tools/registry.ts                  # 集成确认机制
src/core/agent.ts                      # executeTool 传递 channel/chatId，不再接收或处理 approvalManager
src/bus/queue.ts                       # 新增 setInboundApprovalCheck、publishInbound 入队前审批检查
src/cli/setup.ts                       # buildAgentRuntime 中 bus.setInboundApprovalCheck(approvalManager.handleUserMessage)
src/config/schema.ts                   # 添加approval配置
src/channels/manager.ts                # 支持确认消息处理
```

#### **修改现有工具** (5个)
```
src/tools/shell.ts                     # 标记为HIGH风险
src/tools/spawn.ts                     # 标记为HIGH风险
src/tools/filesystem.ts                # write_file/edit_file标记为MEDIUM
src/tools/message.ts                   # 标记为MEDIUM风险
src/tools/cron.ts                      # 标记为MEDIUM风险
```

### 三、详细实施步骤

#### **阶段1: 基础设施** (新增文件)

**1.1 工具安全级别定义**
```typescript
// src/tools/safety.ts
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium', 
  HIGH = 'high',
}

export interface ToolSafety {
  riskLevel: RiskLevel;
  description?: string;
}

export const DEFAULT_RISK_LEVEL: Record<string, RiskLevel> = {
  exec: RiskLevel.HIGH,
  spawn: RiskLevel.HIGH,
  write_file: RiskLevel.MEDIUM,
  edit_file: RiskLevel.MEDIUM,
  delete_file: RiskLevel.MEDIUM,
  message: RiskLevel.MEDIUM,
  cron: RiskLevel.MEDIUM,
  read_file: RiskLevel.LOW,
  list_dir: RiskLevel.LOW,
  web_search: RiskLevel.LOW,
  web_fetch: RiskLevel.LOW,
};
```

**1.2 扩展Tool基类**
```typescript
// 修改 src/tools/base.ts
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, unknown>;
  
  // 新增：风险级别
  riskLevel: RiskLevel = RiskLevel.LOW;
  
  abstract execute(params: Record<string, unknown>): Promise<string>;
  
  // 新增：是否需要确认（可被子类覆盖）
  needsApproval(): boolean {
    return this.riskLevel === RiskLevel.HIGH || this.riskLevel === RiskLevel.MEDIUM;
  }
}
```

**1.3 确认配置Schema**
```typescript
// 新增 src/config/approval-schema.ts
import { z } from 'zod';

export const ApprovalConfigSchema = z.object({
  /** 是否启用确认机制 */
  enabled: z.boolean().default(true),
  
  /** 会话记忆时间窗口（秒） */
  memoryWindow: z.number().int().positive().default(300), // 5分钟
  
  /** 超时时间（秒） */
  timeout: z.number().int().positive().default(60),
  
  /** 覆盖特定工具的默认策略 */
  toolOverrides: z.record(
    z.object({
      requiresApproval: z.boolean(),
    })
  ).default({}),
  
  /** 低风险工具也要求确认（严格模式） */
  strictMode: z.boolean().default(false),
});
```

**1.4 确认管理器核心**
```typescript
// 新增 src/core/approval.ts
export class ApprovalManager {
  private handlers: Map<string, ApprovalHandler>;
  private memory: ApprovalMemory;
  private config: ApprovalConfig;
  private defaultRiskLevels: Record<string, RiskLevel>;
  
  constructor(config: ApprovalConfig) {
    this.config = config;
    this.memory = new ApprovalMemory(config.memoryWindow);
    this.handlers = new Map();
    this.defaultRiskLevels = DEFAULT_RISK_LEVEL;
  }
  
  // 注册确认处理器
  registerHandler(channel: string, handler: ApprovalHandler): void {
    this.handlers.set(channel, handler);
  }
  
  // 检查是否需要确认
  async needsApproval(
    toolName: string,
    params: Record<string, unknown>,
    toolRiskLevel?: RiskLevel,
    channel: string,
    chatId: string
  ): Promise<boolean> {
    if (!this.config.enabled) return false;
    
    // 检查配置覆盖
    if (toolName in this.config.toolOverrides) {
      return this.config.toolOverrides[toolName].requiresApproval;
    }
    
    // 获取风险级别
    const riskLevel = toolRiskLevel ?? this.defaultRiskLevels[toolName] ?? RiskLevel.LOW;
    
    // 严格模式
    if (this.config.strictMode && riskLevel !== RiskLevel.LOW) {
      return true;
    }
    
    // 高风险总是确认
    if (riskLevel === RiskLevel.HIGH) {
      return true;
    }
    
    // 中风险：检查会话记忆
    if (riskLevel === RiskLevel.MEDIUM) {
      return !this.memory.hasApproved(toolName, params, channel, chatId);
    }
    
    // 低风险无需确认
    return false;
  }
  
  // 请求确认
  async requestApproval(
    toolName: string,
    params: Record<string, unknown>,
    channel: string,
    chatId: string
  ): Promise<boolean> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      logger.warn(`No approval handler for channel: ${channel}`);
      return false;
    }
    
    const approved = await handler.requestConfirmation({
      toolName,
      params,
      channel,
      chatId,
      timeout: this.config.timeout,
    });
    
    if (approved) {
      this.memory.recordApproval(toolName, params, channel, chatId);
    }
    
    return approved;
  }
}

// 会话记忆
class ApprovalMemory {
  private approvals: Map<string, { timestamp: number }>;
  private windowMs: number;
  
  constructor(windowSeconds: number) {
    this.windowMs = windowSeconds * 1000;
    this.approvals = new Map();
  }
  
  private getCacheKey(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): string {
    // 简化参数，只取关键部分
    const paramsKey = JSON.stringify(params).slice(0, 200);
    return `${channel}:${chatId}:${toolName}:${paramsKey}`;
  }
  
  hasApproved(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): boolean {
    const key = this.getCacheKey(toolName, params, channel, chatId);
    const record = this.approvals.get(key);
    
    if (!record) return false;
    
    const now = Date.now();
    if (now - record.timestamp > this.windowMs) {
      this.approvals.delete(key);
      return false;
    }
    
    return true;
  }
  
  recordApproval(toolName: string, params: Record<string, unknown>, channel: string, chatId: string): void {
    const key = this.getCacheKey(toolName, params, channel, chatId);
    this.approvals.set(key, { timestamp: Date.now() });
  }
  
  clearExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.approvals.entries()) {
      if (now - record.timestamp > this.windowMs) {
        this.approvals.delete(key);
      }
    }
  }
}
```

**1.5 确认处理器接口**
```typescript
// 新增 src/core/approval-handlers/index.ts
export interface ApprovalHandler {
  requestConfirmation(req: ConfirmationRequest): Promise<boolean>;
}

export interface ConfirmationRequest {
  toolName: string;
  params: Record<string, unknown>;
  channel: string;
  chatId: string;
  timeout: number;
}
```

**1.6 CLI确认处理器**
```typescript
// 新增 src/core/approval-handlers/cli.ts
import inquirer from 'inquirer';

export class CLIApprovalHandler implements ApprovalHandler {
  async requestConfirmation(req: ConfirmationRequest): Promise<boolean> {
    const { toolName, params } = req;
    
    // 格式化参数显示
    const paramsDisplay = Object.entries(params)
      .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 50)}`)
      .join(', ');
    
    const message = `\n⚠️  工具执行需要确认\n` +
                    `   工具: ${toolName}\n` +
                    `   参数: ${paramsDisplay}\n` +
                    `   是否继续?`;
    
    try {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'approved',
          message,
          default: false,
        },
      ]);
      
      return answer.approved;
    } catch (error) {
      logger.error({ error }, 'Confirmation failed');
      return false;
    }
  }
}
```

**1.7 消息确认处理器**
- 请求确认：发送确认消息到渠道，创建 Promise 并登记 pendingApprovals / approvalsByChatId，等待用户回复或超时。
- **处理用户回复**：通过 `handleResponse(channel, chatId, content)`。若 content 为 yes/no 且该 chatId 有待处理确认，则 resolve 对应 Promise 并清理，返回 true；否则返回 false。
- **与总线的配合**：审批回复必须在**入队前**被消费，否则 Agent 阻塞在 requestConfirmation 时无法从队列取到 yes/no。因此由 `bus.setInboundApprovalCheck(() => approvalManager.handleUserMessage(...))` 在 `publishInbound` 时先调用，若返回 true 则消息不入队。

#### **阶段2: 集成到现有代码**

**2.1 修改ToolRegistry**
```typescript
// 修改 src/tools/registry.ts
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  private approvalManager?: ApprovalManager; // 新增
  
  // 新增：设置确认管理器
  setApprovalManager(manager: ApprovalManager): void {
    this.approvalManager = manager;
  }
  
  async execute(name: string, params: Record<string, unknown>, context?: {
    channel?: string;
    chatId?: string;
  }): Promise<string> {
    // ... 现有代码 ...
    
    // 新增：检查是否需要确认
    if (this.approvalManager && context?.channel && context?.chatId) {
      const tool = this.tools.get(name);
      const needsApproval = await this.approvalManager.needsApproval(
        name,
        params,
        tool?.riskLevel,
        context.channel,
        context.chatId
      );
      
      if (needsApproval) {
        const approved = await this.approvalManager.requestApproval(
          name,
          params,
          context.channel,
          context.chatId
        );
        
        if (!approved) {
          const errorMsg = `Tool "${name}" execution declined by user`;
          logger.warn(errorMsg);
          return errorMsg + ERROR_HINT;
        }
      }
    }
    
    // 执行工具
    const result = await tool.execute(params);
    // ...
  }
}
```

**2.2 修改Agent**
```typescript
// 修改 src/core/agent.ts
// Agent 主循环仅消费入队消息并处理，不再接收 approvalManager，也不在循环内判断审批回复。
// 消息渠道的 yes/no 由总线的 setInboundApprovalCheck 在 publishInbound 时处理，不入队。

async _processMessage(...): Promise<OutboundMessage> {
  // ...
  const chatParams: Parameters<LLMProvider['chat']>[0] = {
    messages,
    tools,
    model: this.config.agents.defaults.model,
    temperature: this.config.agents.defaults.temperature,
    maxTokens: this.config.agents.defaults.maxTokens,
    maxSteps: this.maxIterations,
    executeTool: async (name, args) => {
      let result = await this.tools.execute(name, args, {
        channel,
        chatId,
      });
      if (result.length > AgentLoop.TOOL_RESULT_MAX_CHARS) {
        result = result.slice(0, AgentLoop.TOOL_RESULT_MAX_CHARS) + '\n... (truncated)';
      }
      return `Tool "${name}" returned:\n${result}`;
    },
  };
  // ...
}
```

**2.2.1 消息渠道 yes/no 入队前处理（当前实现）**
- 在 `src/bus/queue.ts` 中，MessageBus 提供 `setInboundApprovalCheck(fn: (msg: InboundMessage) => boolean)`。
- 在 `publishInbound(msg)` 开头：若存在该回调且 `fn(msg)` 返回 true，则直接 return，不 push、不唤醒 consumer。
- 在 `src/cli/setup.ts` 的 `buildAgentRuntime` 中，创建 ApprovalManager 后执行：
  `bus.setInboundApprovalCheck((m) => approvalManager.handleUserMessage(m.channel, m.chatId, m.content));`
- 这样 Feishu/Email 等渠道的用户回复 yes/no 在入队前即被 `MessageApprovalHandler.handleResponse` 消费并 resolve 对应 `requestConfirmation` 的 Promise，避免「Agent 阻塞在等待审批时无法消费队列中的 yes 导致超时」。

**2.3 修改现有工具**
```typescript
// 修改 src/tools/shell.ts
import { RiskLevel } from './safety';

export class ExecTool extends Tool {
  name = 'exec';
  description = '执行 Shell 命令';
  riskLevel = RiskLevel.HIGH; // 新增
  // ...
}

// 修改 src/tools/spawn.ts
import { RiskLevel } from './safety';

export class SpawnTool extends Tool {
  name = 'spawn';
  description = '生成后台进程';
  riskLevel = RiskLevel.HIGH; // 新增
  // ...
}

// 修改 src/tools/filesystem.ts
import { RiskLevel } from './safety';

export class WriteFileTool extends FileTool {
  name = 'write_file';
  description = '写入文件';
  riskLevel = RiskLevel.MEDIUM; // 新增
  // ...
}

export class EditFileTool extends FileTool {
  name = 'edit_file';
  description = '编辑文件';
  riskLevel = RiskLevel.MEDIUM; // 新增
  // ...
}
```

**2.4 修改配置Schema**
```typescript
// 修改 src/config/schema.ts
import { ApprovalConfigSchema } from './approval-schema';

export const ToolsConfigSchema = z.object({
  restrictToWorkspace: z.boolean().default(false),
  exec: ExecConfigSchema,
  web: WebConfigSchema,
  approval: ApprovalConfigSchema, // 新增
});
```

**2.5 集成到渠道管理器**
```typescript
// 修改 src/channels/manager.ts
export class ChannelManager {
  private approvalManager?: ApprovalManager;
  
  constructor(config: Config) {
    // ...
    if (config.tools.approval.enabled) {
      this.approvalManager = new ApprovalManager(config.tools.approval);
      
      // 注册CLI处理器
      this.approvalManager.registerHandler('cli', new CLIApprovalHandler());
      
      // 注册消息处理器（用于其他渠道）
      const bus = new MessageBus();
      this.approvalManager.registerHandler('message', new MessageApprovalHandler(bus));
    }
  }
  
  // 处理用户消息（用于确认回复）
  async handleUserMessage(msg: InboundMessage): Promise<boolean> {
    if (this.approvalManager && msg.channel !== 'cli') {
      const handler = this.approvalManager.getHandler(msg.channel);
      if (handler instanceof MessageApprovalHandler) {
        return handler.handleResponse(msg.chatId, msg.content);
      }
    }
    return false;
  }
  
  getApprovalManager(): ApprovalManager | undefined {
    return this.approvalManager;
  }
}
```

#### **阶段3: 初始化集成**

**3.1 修改主入口 / buildAgentRuntime**
- 创建 MessageBus、ApprovalManager（传入 bus），ToolRegistry.setApprovalManager(approvalManager)。
- **关键**：`bus.setInboundApprovalCheck((m) => approvalManager.handleUserMessage(m.channel, m.chatId, m.content));` 使消息渠道的 yes/no 在 publishInbound 时即被处理，不入队。
- AgentLoop 不再接收 approvalManager，仅消费队列中的入站消息并调用 _processMessage。

### 四、配置示例

```json
{
  "agents": {
    "defaults": {
      "model": "openai:gpt-4o",
      "workspace": "~/.nanobot/workspace"
    }
  },
  "tools": {
    "approval": {
      "enabled": true,
      "memoryWindow": 300,
      "timeout": 60,
      "strictMode": false,
      "toolOverrides": {
        "exec": {
          "requiresApproval": true
        },
        "write_file": {
          "requiresApproval": false
        }
      }
    }
  }
}
```

### 五、测试策略

1. **单元测试**: 确认管理器、会话记忆、处理器
2. **集成测试**: 工具注册表集成、Agent集成
3. **端到端测试**: 
   - CLI模式下确认流程
   - 消息渠道确认流程
   - 会话记忆功能

### 六、向后兼容性

- 默认情况下确认机制可启用/禁用
- 现有工具如果不设置riskLevel，默认为LOW（无需确认）
- 可通过配置完全禁用确认机制

---

## 📦 文件清单

**新增文件 (7个):**
```
src/tools/safety.ts
src/core/approval.ts
src/core/approval-handlers/index.ts
src/core/approval-handlers/cli.ts
src/core/approval-handlers/message.ts
src/core/approval-handlers/memory.ts
src/config/approval-schema.ts
```

**修改文件 (12个):**
```
src/tools/base.ts
src/tools/shell.ts
src/tools/spawn.ts
src/tools/filesystem.ts
src/tools/message.ts
src/tools/cron.ts
src/tools/registry.ts
src/core/agent.ts
src/bus/queue.ts
src/cli/setup.ts
src/config/schema.ts
src/channels/manager.ts
```

**测试文件 (新增5个):**
```
tests/unit/core/approval.test.ts
tests/unit/core/approval-memory.test.ts
tests/unit/core/cli-approval.test.ts
tests/unit/core/message-approval.test.ts
tests/integration/approval-flow.test.ts
```

---

这个计划提供了完整的实施路径，涵盖了从基础架构到集成、测试的所有方面。是否需要我调整某些部分，或者开始实施？