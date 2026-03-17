# opencode question 工具的完整流程

## 整体架构

``` bash
AI Agent → Question Tool → Question.ask() → Bus.publish() → SSE → 前端展示 → 用户回答 → Question.reply() → Promise.resolve() → 继续执行
```

## 详细流程

### 1️⃣ **Agent 触发问题**

```typescript
// packages/opencode/src/tool/question.ts:6-32
QuestionTool.execute({
  questions: [{
    question: "完整问题文本",
    header: "简短标签",
    options: [{ label, description }],
    multiple: false,
    custom: true
  }]
})
```

### 2️⃣ **创建待处理请求** (`packages/opencode/src/question/index.ts:98-122`)

```typescript
async function ask() {
  const id = QuestionID.ascending()  // 生成唯一ID
  
  // 创建 Promise（阻塞直到用户回答）
  return new Promise<Answer[]>((resolve, reject) => {
    // 存储到 pending 状态
    s.pending[id] = { info, resolve, reject }
    
    // 发布事件通知前端
    Bus.publish(Event.Asked, info)
  })
}
```

### 3️⃣ **事件传播** (`packages/opencode/src/bus/index.ts:41-64`)

```typescript
// 1. 通知本地订阅者
// 2. 转发到全局总线
GlobalBus.emit("event", {
  directory: Instance.directory,
  payload: { type: "question.asked", properties: info }
})
```

### 4️⃣ **SSE 推送到前端** (`packages/opencode/src/server/routes/global.ts:67-108`)

```typescript
// 前端通过 EventSource 连接 GET /global/event
streamSSE(c, async (stream) => {
  GlobalBus.on("event", handler)  // 监听所有事件
  stream.writeSSE({ data: JSON.stringify(event) })
})
```

### 5️⃣ **前端接收并展示** (`packages/app/src/context/global-sync/event-reducer.ts:314-334`)

```typescript
case "question.asked": {
  const question = event.properties
  // 添加到 store
  input.setStore("question", question.sessionID, [question])
}
```

```typescript
// packages/app/src/pages/session/composer/session-question-dock.tsx:13-444
// 展示问题界面，支持：
// - 单选/多选
// - 自定义输入
// - 多问题切换
```

### 6️⃣ **用户提交回答** (`packages/app/src/pages/session/composer/session-question-dock.tsx:129-161`)

```typescript
const submit = () => {
  reply(questions().map((_, i) => store.answers[i] ?? []))
}

async function reply(answers: QuestionAnswer[]) {
  await sdk.client.question.reply({ requestID, answers })
}
```

### 7️⃣ **后端处理回答** (`packages/opencode/src/server/routes/question.ts:34-68`)

```typescript
POST /question/:requestID/reply
await Question.reply({ requestID, answers })
```

### 8️⃣ **解析 Promise** (`packages/opencode/src/question/index.ts:124-142`)

```typescript
async function reply() {
  const existing = s.pending[input.requestID]
  delete s.pending[input.requestID]  // 从待处理移除
  
  // 发布事件（前端会清理 UI）
  Bus.publish(Event.Replied, { ... })
  
  // 关键：触发 Agent 继续执行
  existing.resolve(input.answers)
}
```

### 9️⃣ **返回工具结果** (`packages/opencode/src/tool/question.ts:18-32`)

```typescript
const answers = await Question.ask({...})  // 等待完成
return {
  title: `Asked N question(s)`,
  output: `User has answered: ...`,
  metadata: { answers }
}
```

---

## 关键技术点

| 组件 | 技术 | 作用 |
|------|------|------|
| **状态管理** | `Map<pendingID, {resolve, reject}>` | 存储待处理的 Promise |
| **事件总线** | `Bus.publish()` + SSE | 解耦组件通信 |
| **实时推送** | Server-Sent Events (SSE) | 后端 → 前端实时通知 |
| **异步阻塞** | `new Promise()` | 阻塞 Agent 执行直到用户回答 |
| **前端状态** | SolidJS Store | 响应式更新 UI |

## 可复用设计模式

```typescript
// 1. 定义状态
const pending = new Map<string, { resolve, reject }>()

// 2. 发起请求（返回 Promise）
async function ask() {
  return new Promise((resolve, reject) => {
    pending[id] = { resolve, reject }
    publish("asked", { id, data })
  })
}

// 3. 处理回答
async function reply(id, data) {
  const existing = pending.get(id)
  if (!existing) return
  pending.delete(id)
  publish("replied", { id })
  existing.resolve(data)
}
```

### 时序图

AI Agent ───────────────> Question Tool ───────────────> Question.ask()
        │                           │                        │
        │  1. Agent 调用工具      │  2. execute() 调用   │  3. 创建 Promise
        │  question({questions})   │  Question.ask()      │  (阻塞等待)
        │                           │                        │
        │                           │                        ├─> publish(Asked)
        │                           │                        │      ↓
        │                           │                        │   [前端展示问题]
        │                           │                        │      ↓
        │                           │                        │   [用户回答]
        │                           │                        │      ↓
        │                           │                        │<─ Question.reply()
        │                           │                        │      resolve(answers)
        │                           │<─ 等待完成            │
        │<─ 返回工具结果            │                        │
        │  { output, answers }       │                        │
        │                           │                        │

### 完整的控制流

Agent ──调用工具──> Tool.execute()
                       │
                       ├─ Question.ask()  ← 阻塞点
                       │     │
                       │     ├─ pending[id] = {resolve, reject}
                       │     └─ Bus.publish(Asked) ──> SSE ──> 前端展示
                       │
等待用户...
                       │
                       │<─────────────────────────────────
                       │      用户点击"提交"
                       │      POST /question/:id/reply
                       │      Question.reply(id, answers)
                       │          ├─ resolve(answers)  ← 解除阻塞
                       │          └─ Bus.publish(Replied)
                       │
Tool.execute() 继续执行
   │
   └─ return { title, output, metadata }
