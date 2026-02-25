# Gateway 模式调用流程图

本文档描述 `nanobot gateway` 的完整调用链，从启动到用户输入、Agent 处理、工具执行、出站分发的全流程。

---

## 一、整体架构（启动后常驻组件）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          nanobot gateway 进程                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   Readline   │     │ MessageBus  │     │  AgentLoop   │     │ ChannelMgr  │  │
│  │  (You> 输入)  │────▶│  inbound    │────▶│ consumeInbound│     │ outbound    │  │
│  └──────────────┘     │  outbound   │◀────│ publishOutbound│◀───│ consumeOutbound│
│         ▲             └──────┬──────┘     └───────┬──────┘     └──────┬──────┘  │
│         │                    │                    │                   │         │
│         │                    │                    │                   ▼         │
│         │                    │                    │            ┌─────────────┐  │
│         │                    │                    │            │ CLIChannel  │  │
│         │                    │                    │            │ .send(msg)  │  │
│         │                    │                    │            │ → Bot> 输出  │  │
│         │                    │                    │            └─────────────┘  │
│         │                    │                    │                             │
│         │                    │         ┌───────────┴───────────┐                 │
│         │                    │         │ LLMProvider.chat()    │                 │
│         │                    │         │ (generateText+execute)│                 │
│         │                    │         └───────────┬──────────┘                 │
│         │                    │                     │                             │
│         │                    │         ┌───────────▼───────────┐                 │
│         │                    │         │ ToolRegistry.execute  │                 │
│         │                    │         │ (read_file, exec...)  │                 │
│         │                    └─────────│ CronService.onJob ────┼──▶ publishInbound│
│         │                              └───────────────────────┘    (定时触发)   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、启动顺序（cmdGateway 初始化流程）

```mermaid
sequenceDiagram
    participant User
    participant CLI as cmdGateway
    participant Config
    participant Bus as MessageBus
    participant Sessions
    participant Provider as LLMProvider
    participant Tools as ToolRegistry
    participant Cron as CronService
    participant Agent as AgentLoop
    participant Mgr as ChannelManager
    participant RL as Readline

    User->>CLI: nanobot gateway
    CLI->>Config: loadConfig()
    CLI->>Bus: new MessageBus()
    CLI->>Sessions: new SessionManager(workspace)
    Sessions->>Sessions: init()
    CLI->>Provider: new LLMProvider(config)
    CLI->>Tools: register(ReadFile, WriteFile, EditFile, ListDir, Exec, WebSearch, WebFetch, Message)
    CLI->>Cron: new CronService(storePath, onJob→publishInbound)
    Cron->>Cron: start()  # 加载 cron.json，arm 定时器
    CLI->>Tools: register(SpawnTool, CronTool)
    CLI->>Agent: new AgentLoop(bus, provider, tools, sessions, config, memory, skills)
    CLI->>Mgr: new ChannelManager(config, bus)
    CLI->>Mgr: registerChannel('cli', CLIChannel)
    CLI->>Mgr: loadChannelsFromConfig(bus)  # 按 config 加载 whatsapp/feishu/email
    CLI->>Mgr: startAll()   # 各 channel.start()
    CLI->>Mgr: runOutboundLoop()  # 后台循环 consumeOutbound → channel.send()
    CLI->>Agent: agent.run()  # 后台 while: consumeInbound → _processMessage → publishOutbound
    CLI->>RL: createInterface(stdin, stdout)
    CLI->>User: info('Gateway started...')
    RL->>User: You> (等待输入)
```

---

## 三、用户输入到回复（单轮对话）

```mermaid
sequenceDiagram
    participant User
    participant RL as Readline
    participant Bus as MessageBus
    participant Agent as AgentLoop
    participant Session as SessionManager
    participant Context as ContextBuilder
    participant Provider as LLMProvider
    participant SDK as generateText (AI SDK)
    participant Tools as ToolRegistry
    participant Mgr as ChannelManager
    participant CLICh as CLIChannel

    User->>RL: 输入 "今天天气" + Enter
    RL->>Bus: publishInbound({ channel:'cli', chatId:'direct', content, senderId:'user' })
    Note over Bus: inboundQueue.push(msg); 若有 consumer 则 resolve(consumer)

    Agent->>Bus: consumeInbound()  # 被 resolve，拿到 msg
    Agent->>Agent: _processMessage(msg)

    Note over Agent: 1) sessionKey = getSessionKey(msg)
    Agent->>Agent: 2) 若 content 为 /new 或 /help，直接 return 出站
    Agent->>Agent: 3) 对 spawn/cron 等工具 setContext(channel, chatId)
    Agent->>Session: addMessage(sessionKey, { role:'user', content })
    Agent->>Session: getHistory(sessionKey, memoryWindow)
    Agent->>Context: buildSystemPrompt(memory, skills, workspace)
    Agent->>Context: buildMessages(systemPrompt, history, currentMessage, channel, chatId)
    Note over Agent: messages = [system, ...history, user with runtime context]

    Agent->>Provider: chat({ messages, tools, maxSteps, executeTool, onStepFinish })
    Provider->>Provider: buildToolsWithExecute(tools, executeTool)
    Provider->>SDK: generateText(model, messages, toolsWithExecute, stopWhen: stepCountIs(maxSteps))

    loop 多步直到无 tool call 或达到 maxSteps
        SDK->>SDK: 调用 LLM
        alt 模型返回 tool calls
            SDK->>Provider: 对每个 tool 调用 execute(args)
            Provider->>Tools: executeTool(name, args) 即 tools.execute(name, args)
            Tools->>Tools: 执行 read_file / exec / cron 等
            Tools-->>Provider: 返回字符串（可能被截断）
            Provider-->>SDK: "Tool \"xxx\" returned:\n..."
            SDK->>SDK: 将 tool 结果加入 messages，继续下一轮 generateText
        else 模型返回纯文本
            SDK-->>Provider: result.text
        end
    end

    SDK-->>Provider: result { text, usage }
    Provider-->>Agent: LLMResponse { content, hasToolCalls: false }
    Agent->>Agent: _stripThink(content)
    Agent->>Session: addMessage(sessionKey, { role:'assistant', content })
    Agent->>Agent: 若 memory.needsConsolidation 则 consolidate
    Agent->>Bus: publishOutbound({ channel, chatId, content })

    Note over Bus: outboundQueue.push(msg); 若有 consumer 则 resolve(consumer)
    Mgr->>Bus: consumeOutbound()  # 被 resolve，拿到 msg
    Mgr->>Mgr: getChannel(msg.channel)  # 例如 'cli'
    Mgr->>CLICh: send(msg)
    CLICh->>User: console.log('\nBot>', msg.content)

    RL->>User: You> (再次等待输入)
```

---

## 四、MessageBus 入站/出站队列与消费者

```mermaid
flowchart LR
    subgraph Inbound
        A1[入站队列 inboundQueue]
        A2[入站消费者 inboundConsumers]
        A3[publishInbound]
        A4[consumeInbound]
    end
    subgraph Outbound
        B1[出站队列 outboundQueue]
        B2[出站消费者 outboundConsumers]
        B3[publishOutbound]
        B4[consumeOutbound]
    end

    A3 --> A1
    A1 --> A4
    A4 --> A2
    A3 -.->|若有 consumer| A2

    B3 --> B1
    B1 --> B4
    B4 --> B2
    B3 -.->|若有 consumer| B2
```

- **入站**：Readline / Cron / 其他 Channel 调用 `publishInbound`；唯一消费者是 **AgentLoop.run()** 里的 `consumeInbound()`。
- **出站**：Agent 在 `_processMessage` 结束后调用 `publishOutbound`；唯一消费者是 **ChannelManager._outboundLoop()** 里的 `consumeOutbound()`。

---

## 五、Agent _processMessage 内部步骤（细化）

```mermaid
flowchart TB
    A[收到 InboundMessage] --> B{sessionKey = getSessionKey}
    B --> C{content 是 /new?}
    C -->|是| D[归档会话 + clear, 返回 已开启新会话]
    C -->|否| E{content 是 /help?}
    E -->|是| F[返回帮助文本]
    E -->|否| G[对 spawn/cron 等 setContext]
    G --> H[addMessage 用户消息]
    H --> I[getHistory]
    I --> J[buildSystemPrompt: Identity + Memory + Skills]
    J --> K[buildMessages: system + history + user 含 Runtime Context]
    K --> L[getDefinitions 工具 schema]
    L --> M[provider.chat: messages, tools, executeTool, maxSteps]
    M --> N[generateText 内部多步: LLM → 若有 tool call 则 execute → 再 LLM]
    N --> O[stripThink 得到最终 content]
    O --> P[addMessage 助手消息]
    P --> Q{memory.needsConsolidation?}
    Q -->|是| R[consolidate + saveSession]
    Q -->|否| S[返回 OutboundMessage]
    R --> S
    D --> S
    F --> S
```

---

## 六、Cron 定时触发入站

```mermaid
sequenceDiagram
    participant Timer as CronService 定时器
    participant Cron as CronService
    participant Bus as MessageBus
    participant Agent as AgentLoop
    participant Mgr as ChannelManager
    participant CLICh as CLIChannel
    participant User

    Timer->>Cron: setTimeout 到期 → onTimer()
    Cron->>Cron: loadStore(), 找出 due jobs
    loop 每个到期 job
        Cron->>Cron: executeJob(job)
        Cron->>Bus: onJob(job) 即 publishInbound({ channel, chatId, content: job.payload.message, senderId:'cron' })
    end
    Cron->>Cron: saveStore(), armTimer()

    Bus->>Agent: consumeInbound() 返回该条（或 Agent 早已在等）
    Agent->>Agent: _processMessage(msg)  # 与用户输入路径完全相同
    Agent->>Bus: publishOutbound(response)
    Bus->>Mgr: consumeOutbound()
    Mgr->>CLICh: send(msg)
    CLICh->>User: Bot> 回复内容
```

- Cron 的 **onJob** 只做一件事：按 job 的 `channel`/`to` 和 `message` 构造一条 **InboundMessage** 并 **publishInbound**，后续与「用户输入」走同一条 Agent → 出站 → Channel 链路。

---

## 七、ChannelManager 出站分发循环

```mermaid
flowchart TB
    A[_outboundLoop] --> B[msg = await bus.consumeOutbound]
    B --> C{channels.get(msg.channel)}
    C -->|有| D[channel.send(msg)]
    C -->|无| E[logger.warn 未注册渠道]
    D --> F{running?}
    E --> F
    F -->|是| B
    F -->|否| G[循环结束]
```

- 注册的 channel 至少有一个 **cli**（CLIChannel）；若 config 启用 whatsapp/feishu/email，也会在 **loadChannelsFromConfig** 里注册，出站时按 `msg.channel` 选对应 channel 的 **send(msg)**。

---

## 八、Provider.chat 与 AI SDK generateText

```mermaid
flowchart LR
    subgraph Agent
        A[chatParams: messages, tools, executeTool, maxSteps]
    end
    subgraph Provider
        B[buildToolsWithExecute: 每个 tool 加 execute]
        C[generateText(toolsWithExecute, stopWhen: stepCountIs(maxSteps))]
    end
    subgraph SDK
        D[步 1: LLM 调用]
        E{有 tool calls?}
        F[对每个 tool 调用 execute]
        G[把结果当 tool message 追加]
        H[步 2: 再调 LLM]
        I[重复直到无 tool call 或达到 maxSteps]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E -->|是| F
    F --> G
    G --> H
    H --> E
    E -->|否| I
```

- **executeTool** 在 Agent 里实现为：`tools.execute(name, args)` + 结果截断 + 包装成 `"Tool \"name\" returned:\n..."` 字符串，由 Provider 注入到每个 tool 的 **execute**，SDK 在内部多步循环中自动调用。

---

## 九、文件与角色速查

| 角色 | 文件 | 职责 |
|------|------|------|
| 入口 | `src/cli/commands.ts` | `cmdGateway`: 组装 Bus、Sessions、Provider、Tools、Cron、Agent、ChannelManager，启动 agent.run 与 readline |
| 总线 | `src/bus/queue.ts` | `MessageBus`: inbound/outbound 队列与 publish/consume |
| 代理 | `src/core/agent.ts` | `AgentLoop.run` 消费 inbound，`_processMessage` 内调 provider.chat（带 executeTool/maxSteps），最后 publishOutbound |
| 渠道管理 | `src/channels/manager.ts` | 注册 channel，startAll，`_outboundLoop` 消费 outbound 并 `channel.send(msg)` |
| CLI 渠道 | `src/channels/cli.ts` | `CLIChannel.send` 输出 `Bot> content`；gateway 里 Readline 输入时 publishInbound(cli, direct) |
| 定时任务 | `src/cron/service.ts` | 定时到期后 onJob → publishInbound，触发 Agent 处理 |
| LLM | `src/providers/registry.ts` | `chat` 里 buildToolsWithExecute + generateText(maxSteps)，工具由 SDK 自动执行 |

---

以上为 Gateway 模式的完整调用流程与关键数据结构关系；若需某一段的代码级行号或更多分支（如 /new、memory consolidate），可再按模块细化。
