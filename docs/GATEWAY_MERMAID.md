# Nanobot Gateway 模式可视化流程图

## 1. 系统架构总览

```mermaid
graph TB
    subgraph 用户层 [User Layer]
        CLI[CLI 终端]
        WhatsApp[WhatsApp]
        Feishu[飞书]
        Email[邮箱]
    end

    subgraph 渠道层 [Channel Layer]
        CLICh[CLIChannel]
        WACh[WhatsAppChannel]
        FSCh[FeishuChannel]
        EMCh[EmailChannel]
        CM[ChannelManager]
    end

    subgraph 消息层 [Message Layer]
        MB[MessageBus]
        IBQ[InboundQueue]
        OBQ[OutboundQueue]
    end

    subgraph 处理层 [Processing Layer]
        AL[AgentLoop]
        SM[SessionManager]
        MC[MemoryConsolidator]
        SL[SkillLoader]
    end

    subgraph 服务层 [Service Layer]
        LP[LLMProvider]
        TR[ToolRegistry]
        CS[CronService]
        AM[ApprovalManager]
        MCP[MCPManager]
    end

    subgraph 工具层 [Tool Layer]
        FT[文件工具]
        ST[Shell工具]
        WT[Web工具]
        MT[消息/任务工具]
    end

    CLI -->|输入| CLICh
    WhatsApp -->|输入| WACh
    Feishu -->|输入| FSCh
    Email -->|输入| EMCh

    CLICh -->|publishInbound| MB
    WACh -->|publishInbound| MB
    FSCh -->|publishInbound| MB
    EMCh -->|publishInbound| MB

    MB -->|consumeInbound| AL
    MB -->|publishOutbound| CM
    CM -->|send| CLICh
    CM -->|send| WACh
    CM -->|send| FSCh
    CM -->|send| EMCh

    AL -->|管理会话| SM
    AL -->|整合记忆| MC
    AL -->|加载技能| SL
    AL -->|调用LLM| LP
    AL -->|执行工具| TR

    LP -->|generateText| VercelSDK[Vercel AI SDK]

    TR -->|审批检查| AM
    TR -->|分类| FT
    TR -->|分类| ST
    TR -->|分类| WT
    TR -->|分类| MT

    CS -->|定时触发| MB
    MCP -->|加载工具| TR

    AM -->|过滤| MB
```

## 2. 入站消息处理流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant Channel as 渠道(CLI)
    participant Bus as MessageBus
    participant Agent as AgentLoop
    participant SM as SessionManager
    participant LLM as LLMProvider
    participant Tool as ToolRegistry
    participant ChannelMgr as ChannelManager

    User->>Channel: 输入消息
    Channel->>Bus: publishInbound(msg)

    Bus->>Bus: 添加到 inboundQueue
    Bus->>Agent: consumeInbound()

    Agent->>Agent: _processMessage(msg)

    Note over Agent: 检查命令 (/new, /help)

    Agent->>SM: addMessage(userMsg)
    Agent->>SM: getHistory(memoryWindow)

    SM-->>Agent: 历史消息

    Agent->>Agent: 构建系统提示词<br/>(Identity + Memory + Skills)
    Agent->>Agent: 构建消息列表

    Agent->>LLM: chat({messages, tools, ...})

    LLM->>VercelSDK: generateText()

    Note over VercelSDK: 第1步: LLM分析并决定是否需要工具

    alt 需要工具
        VercelSDK->>Tool: executeTool(name, args)
        Tool->>Tool: 执行具体工具
        Tool-->>VercelSDK: 返回结果
        Note over VercelSDK: 第2步: 将结果反馈给LLM
        VercelSDK->>VercelSDK: 继续生成或决定调用更多工具
    end

    VercelSDK-->>LLM: 返回最终响应
    LLM-->>Agent: LLMResponse

    Agent->>SM: addMessage(assistantMsg)

    Note over Agent: 检查是否需要记忆整合

    Agent->>Bus: publishOutbound(outMsg)

    Bus->>Bus: 添加到 outboundQueue
    ChannelMgr->>Bus: consumeOutbound()
    Bus-->>ChannelMgr: 出站消息
    ChannelMgr->>Channel: send(msg)
    Channel->>User: 显示响应
```

## 3. 多渠道并行处理流程

```mermaid
graph LR
    subgraph 输入 [多个输入源]
        CLI[CLI]
        WA[WhatsApp]
        FS[飞书]
        EM[邮箱]
    end

    subgraph 渠道 [渠道层]
        CLICh[CLIChannel]
        WACh[WhatsAppChannel]
        FSCh[FeishuChannel]
        EMCh[EmailChannel]
    end

    subgraph 总线 [消息总线]
        MB[MessageBus<br/>异步队列]
        IBQ[(Inbound<br/>Queue)]
        OBQ[(Outbound<br/>Queue)]
    end

    subgraph 处理 [单Agent处理]
        AL[AgentLoop<br/>顺序处理]
        SM[SessionManager]
        MC[Memory]
        SL[Skills]
    end

    subgraph LLM [LLM调用]
        LP[LLMProvider]
        Tools[工具执行]
    end

    subgraph 输出 [分发回渠道]
        CM[ChannelManager]
    end

    CLI --> CLICh
    WA --> WACh
    FS --> FSCh
    EM --> EMCh

    CLICh -->|入站| MB
    WACh -->|入站| MB
    FSCh -->|入站| MB
    EMCh -->|入站| MB

    MB --> IBQ
    IBQ --> AL

    AL --> SM
    AL --> MC
    AL --> SL
    AL --> LP
    LP --> Tools

    AL -->|出站| MB
    MB --> OBQ
    OBQ --> CM

    CM --> CLICh
    CM --> WACh
    CM --> FSCh
    CM --> EMCh

    CLICh --> CLI
    WACh --> WA
    FSCh --> FS
    EMCh --> EM
```

## 4. 工具执行详细流程

```mermaid
graph TB
    subgraph LLM [LLM决策]
        A[LLM分析消息]
        B{需要工具?}
    end

    subgraph 选择 [工具选择]
        C[选择工具类型]
    end

    subgraph 审批检查 [审批检查]
        Check{需要审批?}
        Request[请求用户审批]
        UserDec{用户决定}
        Approve[批准]
        Deny[拒绝]
    end

    subgraph 文件工具 [文件系统工具]
        RFT[ReadFileTool<br/>读取文件]
        WFT[WriteFileTool<br/>写入文件]
        EFT[EditFileTool<br/>编辑文件]
        DFT[DeleteFileTool<br/>删除文件]
        LDT[ListDirTool<br/>列出目录]
    end

    subgraph Shell工具 [Shell工具]
        ET[ExecTool<br/>执行命令]
    end

    subgraph Web工具 [Web工具]
        WST[WebSearchTool<br/>搜索网页]
        WFT2[WebFetchTool<br/>获取内容]
    end

    subgraph MCP工具 [MCP工具]
        MCP[MCP Server<br/>外部工具]
    end

    subgraph 消息工具 [消息/任务工具]
        MT[MessageTool<br/>发送消息]
        SPT[SpawnTool<br/>生成任务]
        CT[CronTool<br/>定时任务]
    end

    subgraph 反馈 [结果反馈]
        D[返回结果给LLM]
        E{更多工具?}
        F[最终响应]
    end

    A --> B
    B -->|是| C
    B -->|否| F

    C --> Check
    Check -->|是| Request
    Check -->|否| RFT

    Request --> UserDec
    UserDec -->|批准| Approve
    UserDec -->|拒绝| Deny

    Approve --> RFT
    Deny --> D

    C --> WFT
    C --> EFT
    C --> DFT
    C --> LDT
    C --> ET
    C --> WST
    C --> WFT2
    C --> MCP
    C --> MT
    C --> SPT
    C --> CT

    RFT --> D
    WFT --> D
    EFT --> D
    DFT --> D
    LDT --> D
    ET --> D
    WST --> D
    WFT2 --> D
    MCP --> D
    MT --> D
    SPT --> D
    CT --> D

    D --> E
    E -->|是| A
    E -->|否| F
```

## 5. 记忆整合流程

```mermaid
graph TB
    subgraph 检查 [检查触发条件]
        Start[消息处理完成]
        Check1{消息数量>=20?}
        Check2{新增消息<br/>>=threshold?}
        NeedMerge{需要整合?}
    end

    subgraph 提取 [提取记忆]
        Extract[准备未归档消息]
        LLMCall[调用LLM提取重要信息]
        Classify[分类提取内容<br/>1.用户偏好<br/>2.重要决策<br/>3.待办事项<br/>4.技能记录]
    end

    subgraph 存储 [存储记忆]
        Save[写入长期记忆<br/>memory/long-term.md]
        Archive[归档旧消息<br/>memory/archived/]
        Clean[清理会话消息<br/>保留最后5条]
    end

    subgraph 更新 [更新元数据]
        Update[更新lastConsolidated]
        SaveSession[保存会话]
    end

    Start --> Check1
    Check1 -->|否| Skip[跳过整合]
    Check1 -->|是| Check2
    Check2 -->|否| Skip
    Check2 -->|是| NeedMerge
    NeedMerge -->|否| Skip
    NeedMerge -->|是| Extract

    Extract --> LLMCall
    LLMCall --> Classify
    Classify --> Save

    Save --> Archive
    Archive --> Clean
    Clean --> Update

    Update --> SaveSession
    SaveSession --> End[返回响应]

    Skip --> End
```

## 6. 定时任务处理流程

```mermaid
sequenceDiagram
    participant Cron as CronService
    participant Bus as MessageBus
    participant Agent as AgentLoop
    participant LLM as LLMProvider
    participant Tool as ToolRegistry

    Note over Cron: 定时器触发

    Cron->>Cron: 读取任务配置
    Cron->>Bus: publishInbound({<br/>  channel: 'cli',<br/>  senderId: 'cron',<br/>  chatId: 'direct',<br/>  content: '定时消息'<br/>})

    Bus->>Bus: 添加到 inboundQueue

    Agent->>Bus: consumeInbound()

    Bus-->>Agent: 定时消息

    Agent->>Agent: _processMessage(cronMsg)

    Note over Agent: 处理定时任务消息<br/>与普通用户消息相同流程

    Agent->>LLM: chat({...})
    LLM->>Tool: 执行工具 (如需要)
    Tool-->>LLM: 返回结果
    LLM-->>Agent: 响应

    Agent->>Bus: publishOutbound(response)

    Bus->>Bus: 添加到 outboundQueue

    Note over Cron: 等待下一次触发
```

## 7. 错误处理流程

```mermaid
graph TB
    subgraph 监控 [监控]
        AL[AgentLoop<br/>主循环]
        CM[ChannelManager<br/>出站循环]
    end

    subgraph 错误发生 [错误发生]
        Err1[ProviderError<br/>LLM调用失败]
        Err2[ToolError<br/>工具执行失败]
        Err3[SessionError<br/>会话操作失败]
        Err4[ChannelError<br/>渠道发送失败]
        Err5[UnknownError<br/>未知错误]
    end

    subgraph 处理 [错误处理]
        Log[记录错误日志]
        Notify[通知LLM 若是工具错误]
        Retry[重试 仅部分错误]
        Skip[跳过当前消息]
    end

    subgraph 恢复 [系统恢复]
        Continue[继续主循环]
        Wait[等待下一条消息]
    end

    AL -->|捕获异常| Err1
    AL -->|捕获异常| Err2
    AL -->|捕获异常| Err3
    CM -->|捕获异常| Err4
    AL -->|捕获异常| Err5

    Err1 --> Log
    Err2 --> Log
    Err2 --> Notify
    Err3 --> Log
    Err4 --> Log
    Err5 --> Log

    Log --> Continue
    Notify --> Continue
    Continue --> Wait
    Wait --> AL
```

## 8. 审批系统流程

```mermaid
graph TB
    subgraph 工具执行 [工具执行请求]
        Execute[ToolRegistry.execute]
        CheckNeeds[needsApproval]
    end

    subgraph 审批判断 [审批判断逻辑]
        Global{全局开关<br/>enabled?}
        Override{工具覆盖<br/>toolOverrides?}
        GetRisk[获取风险级别<br/>riskLevel]
        RiskHigh{HIGH?}
        RiskMedium{MEDIUM?}
        CheckMemory{检查记忆<br/>hasApproved?}
        StrictMode{严格模式<br/>strictMode?}
        RiskLow{LOW?}
    end

    subgraph 需要审批 [需要用户审批]
        Request[requestApproval]
        GetHandler[getHandler channel]
        CLIHandler[CLIApprovalHandler]
        MsgHandler[MessageApprovalHandler]
        SendRequest[发送审批请求]
        WaitForReply[等待用户回复]
        UserReply{用户回复}
    end

    subgraph 审批决策 [审批决策]
        Approved[用户批准]
        Record[recordApproval<br/>记录到记忆]
        Declined[用户拒绝]
        Deny[拒绝执行]
    end

    subgraph 直接执行 [无需审批]
        ExecuteTool[tool.execute]
    end

    subgraph 消息过滤 [入站消息过滤]
        MessageBus[MessageBus]
        InboundFilter[addInboundFilter]
        HandleMsg[handleUserMessage]
        IsResponse{是审批回复?}
        ProcessApproval[处理审批回复]
    end

    Execute --> CheckNeeds
    CheckNeeds --> Global

    Global -->|否| ExecuteTool
    Global -->|是| Override

    Override -->|有覆盖| IsOverride{requiresApproval?}
    IsOverride -->|是| Request
    IsOverride -->|否| GetRisk

    Override -->|无覆盖| GetRisk
    GetRisk --> RiskHigh

    RiskHigh -->|是| Request
    RiskHigh -->|否| RiskMedium

    RiskMedium -->|是| StrictMode
    RiskMedium -->|否| RiskLow

    StrictMode -->|是| Request
    StrictMode -->|否| CheckMemory

    CheckMemory -->|已批准| ExecuteTool
    CheckMemory -->|未批准| Request

    RiskLow -->|是| ExecuteTool

    Request --> GetHandler
    GetHandler --> CLIHandler
    GetHandler --> MsgHandler

    CLIHandler --> SendRequest
    MsgHandler --> SendRequest

    SendRequest --> WaitForReply
    WaitForReply --> UserReply

    UserReply -->|yes/approve| Approved
    UserReply -->|no/decline| Declined

    Approved --> Record
    Record --> ExecuteTool

    Declined --> Deny

    MessageBus --> InboundFilter
    InboundFilter --> HandleMsg
    HandleMsg --> IsResponse

    IsResponse -->|是| ProcessApproval
    IsResponse -->|否| AgentLoop

    ProcessApproval --> Approved
    ProcessApproval --> Declined
```

## 9. MCP 工具加载流程

```mermaid
graph TB
    subgraph 启动 [系统启动]
        Init[创建 MCPToolLoader]
        LoadConfig[加载配置<br/>workspace/mcp.json]
        CheckEnabled{enabled?}
        CheckServers{servers.length>0?}
    end

    subgraph 连接服务器 [连接 MCP 服务器]
        CreateManager[创建 MCPManager]
        ConnectAll[connectAll]
    end

    subgraph STDIO服务器 [STDIO 类型]
        STDIOCmd[执行命令<br/>command + args]
        STDIOEnv[设置环境变量<br/>env]
        STDIOWork[设置工作目录<br/>cwd]
        STDIOComm[通过 stdin/stdout 通信]
    end

    subgraph HTTP服务器 [HTTP 类型]
        HTTPURL[连接到 URL]
        HTTPOAuth{OAuth配置?}
        HTTPAuth[进行 OAuth 认证]
        HTTPReq[发送 HTTP 请求]
    end

    subgraph 工具包装 [工具包装]
        Wrapper[创建 MCPToolWrapper]
        ListTools[列出所有工具<br/>tools/list]
        Wrap[wrapMCPTools<br/>包装为内部格式]
    end

    subgraph 注册 [注册到工具表]
        Register[toolRegistry.register]
        Validate[验证工具定义]
        Success[注册成功]
        Fail[注册失败<br/>记录警告]
    end

    subgraph 工具执行 [MCP 工具执行]
        Call[LLM 调用 MCP 工具]
        Forward[转发到 MCP 服务器]
        Execute[MCP 服务器执行]
        Return[返回结果]
    end

    Init --> LoadConfig
    LoadConfig --> CheckEnabled

    CheckEnabled -->|否| Skip[跳过 MCP]
    CheckEnabled -->|是| CheckServers

    CheckServers -->|否| Skip
    CheckServers -->|是| CreateManager

    CreateManager --> ConnectAll

    ConnectAll --> STDIOCmd
    ConnectAll --> HTTPURL

    STDIOCmd --> STDIOEnv
    STDIOEnv --> STDIOWork
    STDIOWork --> STDIOComm

    HTTPURL --> HTTPOAuth
    HTTPOAuth -->|有| HTTPAuth
    HTTPOAuth -->|无| HTTPReq
    HTTPAuth --> HTTPReq

    STDIOComm --> Wrapper
    HTTPReq --> Wrapper

    Wrapper --> ListTools
    ListTools --> Wrap

    Wrap --> Register
    Register --> Validate

    Validate --> Success
    Validate --> Fail

    Success --> Ready[MCP 工具就绪]

    Call --> Forward
    Forward --> Execute
    Execute --> Return
    Return --> ToolReg[返回给 ToolRegistry]
```

## 10. 技能加载和使用流程

```mermaid
graph TB
    subgraph 启动 [系统启动]
        Init[创建SkillLoader]
        Scan[扫描技能目录<br/>workspace/skills/]
        Import[动态导入技能模块]
    end

    subgraph 分类 [技能分类]
        Always[alwaysSkills<br/>始终可用]
        OnDemand[onDemandSkills<br/>按需触发]
    end

    subgraph 消息处理 [处理消息]
        Msg[接收用户消息]
        BuildPrompt[构建系统提示词]
    end

    subgraph 提示词结构 [提示词结构]
        Id[Identity<br/>机器人身份]
        Boot[Bootstrap<br/>初始化指令]
        Mem[Memory<br/>长期记忆]
        Skills[Available Skills<br/>alwaysSkills列表]
        Context[Current Context<br/>当前上下文]
    end

    subgraph LLM处理 [LLM处理]
        LLMGen[LLM生成响应]
        UseSkill[使用技能]
    end

    Init --> Scan
    Scan --> Import
    Import --> Always
    Import --> OnDemand

    Always --> BuildPrompt
    Mem --> BuildPrompt

    Msg --> BuildPrompt
    BuildPrompt --> Skills
    Skills --> LLMGen
    LLMGen --> UseSkill
```

## 11. 会话管理流程

```mermaid
graph TB
    subgraph 创建 [会话创建]
        Msg[接收消息]
        Key[生成sessionKey<br/>channel:chatId]
        Check{会话存在?}
    end

    subgraph 新会话 [新会话]
        New[创建新会话]
        InitMsg[初始化消息列表<br/>空数组]
    end

    subgraph 现有会话 [现有会话]
        Load[加载现有会话]
        GetMsg[获取消息列表]
    end

    subgraph 添加 [添加消息]
        AddUser[添加用户消息]
        GetHist[获取历史消息<br/>最后N条]
    end

    subgraph 处理 [处理消息]
        LLM[调用LLM]
        AddAssistant[添加助手响应]
    end

    subgraph 保存 [保存会话]
        Save[保存会话到文件<br/>workspace/sessions/]
    end

    Msg --> Key
    Key --> Check

    Check -->|否| New
    New --> InitMsg
    InitMsg --> AddUser

    Check -->|是| Load
    Load --> GetMsg
    GetMsg --> AddUser

    AddUser --> GetHist
    GetHist --> LLM
    LLM --> AddAssistant
    AddAssistant --> Save
```

## 12. 启动和停止流程

```mermaid
graph TB
    subgraph 启动 [启动流程]
        Start[执行: nanobot gateway]
        LoadCfg[加载配置]
        InitMB[创建MessageBus]
        InitSM[初始化SessionManager]
        InitLP[创建LLMProvider]
        InitTR[初始化ToolRegistry]
        InitAM[创建ApprovalManager]
        InitHandlers[初始化审批处理器]
        SetFilter[设置消息过滤器]
        RegTools[注册所有工具]
        LoadMCP[加载MCP工具]
        InitCS[启动CronService]
        InitMC[初始化MemoryConsolidator]
        InitSL[初始化SkillLoader]
        InitAL[创建AgentLoop]
        InitCM[初始化ChannelManager]
        RegChannels[注册并启动渠道]
        StartOB[启动出站循环]
        StartAL[启动Agent主循环]
        Ready[就绪: 等待用户输入]
    end

    subgraph 停止 [停止流程]
        UserAction[用户: /exit 或 Ctrl+C]
        StopAL[停止AgentLoop]
        StopCM[停止ChannelManager]
        StopMCP[断开MCP服务器]
        StopAll[停止所有渠道]
        CloseCLI[关闭CLI]
        Exit[进程退出]
    end

    Start --> LoadCfg
    LoadCfg --> InitMB
    InitMB --> InitSM
    InitSM --> InitLP
    InitLP --> InitTR
    InitTR --> InitAM
    InitAM --> InitHandlers
    InitHandlers --> SetFilter
    SetFilter --> RegTools
    RegTools --> LoadMCP
    LoadMCP --> InitCS
    InitCS --> InitMC
    InitMC --> InitSL
    InitSL --> InitAL
    InitAL --> InitCM
    InitCM --> RegChannels
    RegChannels --> StartOB
    StartOB --> StartAL
    StartAL --> Ready

    Ready --> UserAction
    UserAction --> StopAL
    StopAL --> StopCM
    StopCM --> StopMCP
    StopMCP --> StopAll
    StopAll --> CloseCLI
    CloseCLI --> Exit
```

## 13. 完整消息流转时序

```mermaid
sequenceDiagram
    autonumber
    participant U as 用户
    participant C as CLIChannel
    participant B as MessageBus
    participant A as AgentLoop
    participant S as SessionManager
    participant L as LLMProvider
    participant T as ToolRegistry
    participant AM as ApprovalManager
    participant CM as ChannelManager

    U->>C: 输入: "帮我分析这个文件"
    C->>B: publishInbound(msg)
    activate B
    B->>B: 加入 inboundQueue
    deactivate B

    A->>B: consumeInbound()
    activate B
    B-->>A: 返回消息
    deactivate B

    A->>A: _processMessage(msg)

    par 步骤1: 会话管理
        A->>S: getOrCreate(sessionKey)
        S-->>A: session对象
        A->>S: addMessage(userMsg)
    and 步骤2: 构建上下文
        A->>S: getHistory(20)
        S-->>A: 历史消息
        A->>A: 构建系统提示词
        A->>A: 构建消息列表
    end

    A->>T: getDefinitions()
    T-->>A: 工具定义列表

    A->>L: chat({messages, tools, ...})
    activate L
    L->>L: generateText()

    Note over L: LLM分析消息

    alt 需要工具
        L->>T: executeTool('read_file', {path})
        activate T

        Note over T: 检查是否需要审批
        alt 需要审批
            T->>AM: needsApproval()
            AM-->>T: true
            T->>AM: requestApproval()
            activate AM
            AM->>C: 发送审批请求
            C->>U: "是否允许执行 read_file?"
            U->>C: "yes"
            C->>AM: 审批结果: approve
            deactivate AM
            AM->>T: 返回审批结果
        end

        T->>T: 读取文件内容
        T-->>L: 返回文件内容
        deactivate T

        Note over L: LLM分析文件内容

        L->>T: executeTool('write_file', {...})
        activate T
        T->>T: 写入分析结果
        T-->>L: 写入成功
        deactivate T
    end

    L-->>A: LLMResponse
    deactivate L

    A->>S: addMessage(assistantMsg)

    par 检查记忆整合
        A->>S: getOrCreate(sessionKey)
        A->>A: needsConsolidation()
        alt 需要整合
            A->>A: consolidate(session)
        end
    end

    A->>B: publishOutbound(response)
    activate B
    B->>B: 加入 outboundQueue
    deactivate B

    CM->>B: consumeOutbound()
    activate B
    B-->>CM: 出站消息
    deactivate B

    CM->>C: send(msg)
    C->>U: 显示: "文件分析完成..."
```

## 14. 组件依赖关系

```mermaid
graph LR
    subgraph 核心依赖
        AL[AgentLoop]
        MB[MessageBus]
        CM[ChannelManager]
    end

    subgraph 支持组件
        SM[SessionManager]
        MC[MemoryConsolidator]
        SL[SkillLoader]
        LP[LLMProvider]
        TR[ToolRegistry]
        CS[CronService]
        AM[ApprovalManager]
        MCP[MCPManager]
    end

    subgraph 基础工具
        FT[文件工具]
        ST[Shell工具]
        WT[Web工具]
        MT[消息工具]
        MCPTools[MCP工具]
    end

    AL --> MB
    AL --> SM
    AL --> MC
    AL --> SL
    AL --> LP
    AL --> TR
    AL --> AM

    CM --> MB
    CM --> C1[CLIChannel]
    CM --> C2[WhatsAppChannel]
    CM --> C3[FeishuChannel]
    CM --> C4[EmailChannel]

    LP --> VSDK[Vercel AI SDK]

    TR --> AM
    TR --> FT
    TR --> ST
    TR --> WT
    TR --> MT
    TR --> MCPTools

    MCP --> MCPTools

    CS --> MB

    AM --> MB

    C1 --> MB
    C2 --> MB
    C3 --> MB
    C4 --> MB

    MT --> MB
```

## 15. 数据流图

```mermaid
graph TB
    subgraph 输入数据 [输入]
        UserMsg[用户消息]
        CronMsg[定时任务消息]
        FileMsg[文件读取]
        WebMsg[网络请求]
    end

    subgraph 处理数据 [处理]
        Session[会话历史]
        Memory[长期记忆]
        Skills[技能描述]
        Tools[工具定义]
    end

    subgraph LLM输入 [LLM输入]
        SysPrompt[系统提示词]
        Msgs[消息列表]
        ToolDefs[工具定义]
    end

    subgraph LLM输出 [LLM输出]
        Text[文本响应]
        ToolCalls[工具调用]
    end

    subgraph 执行数据 [执行]
        ToolRes[工具结果]
        FileRes[文件操作结果]
        ShellRes[命令执行结果]
        WebRes[网络请求结果]
    end

    subgraph 输出数据 [输出]
        AssistantMsg[助手消息]
        Console[控制台输出]
        ChannelMsg[渠道消息]
    end

    UserMsg --> Session
    CronMsg --> Session

    Session --> Msgs
    Memory --> SysPrompt
    Skills --> SysPrompt
    Tools --> ToolDefs

    SysPrompt --> LLM[LLM处理]
    Msgs --> LLM
    ToolDefs --> LLM

    LLM --> Text
    LLM --> ToolCalls

    ToolCalls --> ToolRes
    ToolCalls --> FileRes
    ToolCalls --> ShellRes
    ToolCalls --> WebRes

    ToolRes --> LLM
    FileRes --> LLM
    ShellRes --> LLM
    WebRes --> LLM

    Text --> AssistantMsg
    AssistantMsg --> Session
    AssistantMsg --> Console
    AssistantMsg --> ChannelMsg

    FileMsg --> Session
    WebMsg --> Session
```

## 16. 并发处理模型

```mermaid
graph TB
    subgraph 并发写入 [多个渠道并发写入]
        W1[CLI写入]
        W2[WhatsApp写入]
        W3[飞书写入]
        W4[邮箱写入]
    end

    subgraph 队列 [消息队列]
        Q[(InboundQueue<br/>FIFO)]
    end

    subgraph 顺序处理 [单Agent顺序处理]
        P1[处理消息1]
        P2[处理消息2]
        P3[处理消息3]
        P4[处理消息4]
    end

    subgraph 并发分发 [多个渠道并发分发]
        R1[发送到CLI]
        R2[发送到WhatsApp]
        R3[发送到飞书]
        R4[发送到邮箱]
    end

    W1 --> Q
    W2 --> Q
    W3 --> Q
    W4 --> Q

    Q --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4

    P1 --> R1
    P2 --> R2
    P3 --> R3
    P4 --> R4

    style Q fill:#f9f,stroke:#333,stroke-width:2px
    style P1 fill:#bbf,stroke:#333,stroke-width:2px
    style P2 fill:#bbf,stroke:#333,stroke-width:2px
    style P3 fill:#bbf,stroke:#333,stroke-width:2px
    style P4 fill:#bbf,stroke:#333,stroke-width:2px
```

## 使用说明

这些 Mermaid 图表可以在以下地方查看和渲染：

1. **GitHub**: 直接在 README.md 中显示
2. **VS Code**: 安装 "Mermaid Preview" 插件
3. **在线编辑器**: https://mermaid.live/
4. **Notion/Obsidian**: 原生支持 Mermaid

要查看完整的架构和流程，建议配合 `GATEWAY_FLOW.md` 文档一起使用。
