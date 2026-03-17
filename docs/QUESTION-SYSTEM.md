# Question System

## 概述

Question System 是 nanobot-ts 的一个功能，允许 Agent 在执行过程中向用户提问，以获取更多信息或确认操作。这个系统类似于 Approval 系统，但更灵活，支持自定义问题和选项。

## 功能特性

- ✅ 支持批量提问多个问题
- ✅ CLI 渠道交互式选择
- ✅ Web 渠道实时推送 (SSE)
- ✅ 超时自动取消
- ✅ 可配置的超时时间
- ✅ 多渠道支持 (易于扩展)

## 架构设计

### 核心组件

1. **QuestionManager** (`@nanobot/main/src/core/question.ts`)
   - 管理待处理的问题
   - 发布问题事件到消息总线
   - 处理用户回答
   - 超时处理

2. **QuestionTool** (`@nanobot/main/src/tools/question.ts`)
   - Agent 调用的工具
   - 通过 QuestionManager 发起提问
   - 返回格式化的回答结果

3. **CLIQuestionHandler** (`@nanobot/channels/src/question-handlers/cli.ts`)
   - 处理 CLI 渠道的问题展示
   - 使用 inquirer 库进行交互式选择

4. **Web API Routes** (`@nanobot/server/src/routes/questions.ts`)
   - `/api/v1/questions/:requestID/reply` - 提交回答
   - `/api/v1/questions/:requestID/cancel` - 取消问题
   - `/api/v1/questions/status` - 获取状态

5. **Web Components** (`packages/web/src/components/question-dialog.tsx`)
   - QuestionDialog - 问题对话框组件
   - useEventSource - SSE 连接 hook
   - question-api - API 客户端函数

### 数据流

```
Agent ──调用──> QuestionTool.execute()
    │
    ├─ QuestionManager.ask()
    │     │
    │     ├─ 创建 Promise (阻塞等待)
    │     └─ bus.emit('question', event)
    │
    └─ 等待用户回答...
         │
         ├─ CLI: CLIQuestionHandler.handleQuestions()
         │      └─ inquirer.prompt()
         │
         ├─ Web: QuestionDialog (通过 SSE 接收)
         │      └─ POST /api/v1/questions/:id/reply
         │
         └─ QuestionManager.reply()
               └─ resolve(answers)

Agent 继续...
```

## 配置

在 `~/.nanobot/config.json` 中配置问题系统：

```json
{
  "tools": {
    "question": {
      "enabled": true,
      "timeout": 300,
      "defaultHandler": "cli"
    }
  }
}
```

### 配置说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 是否启用问题系统 |
| `timeout` | number | `300` | 回答超时时间（秒） |
| `defaultHandler` | string | `"cli"` | 默认处理器 (cli/web) |

## 使用示例

### Agent 调用示例

```
User: 帮我配置一个新项目

Agent: 我需要了解一些信息

[调用 question tool]
{
  "questions": [
    {
      "question": "请选择项目类型",
      "header": "项目类型",
      "options": [
        { "label": "Web 应用", "description": "基于 Web 的应用程序" },
        { "label": "CLI 工具", "description": "命令行工具" },
        { "label": "库", "description": "可复用的代码库" }
      ]
    },
    {
      "question": "请选择框架",
      "header": "框架选择",
      "options": [
        { "label": "React", "description": "Facebook 的前端框架" },
        { "label": "Vue", "description": "渐进式前端框架" },
        { "label": "Svelte", "description": "编译型前端框架" }
      ]
    }
  ]
}

[CLI 用户交互]
? 请选择项目类型 (Use arrow keys)
❯ Web 应用 - 基于 Web 的应用程序
  CLI 工具 - 命令行工具
  库 - 可复用的代码库

[用户选择: Web 应用]

? 请选择框架 (Use arrow keys)
  React - Facebook 的前端框架
❯ Vue - 渐进式前端框架
  Svelte - 编译型前端框架

[用户选择: Vue]

Agent: 好的，我将帮你创建一个 Vue Web 项目...

[tool 返回结果]
{
  "title": "Asked 2 question(s)",
  "output": "User answered: Web 应用; Vue",
  "metadata": {
    "answers": [
      { "question": "请选择项目类型", "answer": "Web 应用" },
      { "question": "请选择框架", "answer": "Vue" }
    ]
  }
}
```

### API 调用示例

#### 提交回答

```typescript
import { replyQuestion } from '@/lib/question-api';

await replyQuestion('q_1234567890_abc', {
  answers: [['Web 应用'], ['Vue']]
});
```

#### 取消问题

```typescript
import { cancelQuestion } from '@/lib/question-api';

await cancelQuestion('q_1234567890_abc');
```

#### 获取状态

```typescript
import { getQuestionStatus } from '@/lib/question-api';

const { data } = await getQuestionStatus();
console.log(`Pending questions: ${data?.pendingCount}`);
```

## 事件格式

### QuestionAsked 事件

```typescript
{
  type: 'question.asked',
  requestID: string,
  channel: string,
  chatId: string,
  questions: Question[],
  timestamp: Date
}
```

### QuestionReplied 事件

```typescript
{
  type: 'question.replied',
  requestID: string,
  channel: string,
  chatId: string,
  questions: Question[],
  timestamp: Date
}
```

## 扩展其他渠道

要为新渠道添加问题处理，需要：

1. 创建 `QuestionHandler` 类

```typescript
import type { Question, QuestionManager } from '@nanobot/main';

export class MyChannelQuestionHandler {
  constructor(private questionManager: QuestionManager) {}

  async handleQuestions(requestID: string, questions: Question[]): Promise<void> {
    // 实现渠道特定的问题展示逻辑
    const answers = await this.showQuestions(questions);
    await this.questionManager.reply(requestID, answers);
  }

  private async showQuestions(questions: Question[]): Promise<string[][]> {
    // 实现展示和收集回答的逻辑
  }
}
```

2. 在 Runtime 中添加事件监听器

```typescript
const myQuestionHandler = new MyChannelQuestionHandler(questionManager);
bus.on('question', (event: QuestionEvent) => {
  if (event.type === 'question.asked' && event.channel === 'my-channel') {
    void myQuestionHandler.handleQuestions(event.requestID, event.questions);
  }
});
```

## 常见问题

### 1. 问题超时了怎么办？

默认超时时间是 300 秒（5 分钟）。如果用户在超时时间内没有回答，QuestionManager 会自动拒绝 Promise，Agent 会收到超时错误。可以在配置中调整超时时间。

### 2. 如何在 Agent 中捕获问题超时？

Agent 会收到类似这样的错误：

```
Error: Question timeout after 300s
```

Agent 可以根据需要重试提问或采取其他行动。

### 3. Web 渠道需要做什么配置？

Web 渠道无需额外配置，QuestionDialog 组件会自动通过 SSE 接收问题事件。只需要在聊天页面中引入组件：

```tsx
import { QuestionDialog } from '@/components/question-dialog';
import { replyQuestion } from '@/lib/question-api';

<QuestionDialog
  eventSource={eventSource}
  onReply={replyQuestion}
/>
```

### 4. 如何禁用问题系统？

在配置中设置：

```json
{
  "tools": {
    "question": {
      "enabled": false
    }
  }
}
```

## 测试

运行问题系统的测试：

```bash
# 运行 QuestionManager 测试
cd packages/main
bun test src/core/question.test.ts

# 运行 QuestionTool 测试
cd packages/main
bun test src/tools/question.test.ts
```

## 相关文件

- 类型定义: `packages/shared/src/types/question.ts`
- 配置 Schema: `packages/shared/src/config/question-schema.ts`
- QuestionManager: `packages/main/src/core/question.ts`
- QuestionTool: `packages/main/src/tools/question.ts`
- CLI Handler: `packages/channels/src/question-handlers/cli.ts`
- Server Routes: `packages/server/src/routes/questions.ts`
- SSE Utils: `packages/server/src/utils/sse.ts`
- Web Components: `packages/web/src/components/question-dialog.tsx`
- Web Hooks: `packages/web/src/hooks/use-event-source.ts`
- Web API: `packages/web/src/lib/question-api.ts`
