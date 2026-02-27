## 🎨 人机交互确认流程图

### 完整流程架构

```mermaid
graph TD
    Start([Agent调用工具]) --> CheckEnabled{确认机制已启用?}
    
    CheckEnabled -->|否| ExecuteDirect[直接执行工具]
    CheckEnabled -->|是| CheckToolOverride{工具配置覆盖?}
    
    CheckToolOverride -->|有覆盖| UseOverride[使用配置覆盖策略]
    CheckToolOverride -->|无覆盖| GetRiskLevel[获取工具风险级别]
    
    GetRiskLevel --> CheckRisk{风险级别判断}
    
    CheckRisk -->|LOW| NoApproval[无需确认]
    CheckRisk -->|HIGH| AlwaysConfirm[总是需要确认]
    CheckRisk -->|MEDIUM| CheckMemory{会话记忆中已批准?}
    
    UseOverride --> IsRequired{配置要求确认?}
    IsRequired -->|否| NoApproval
    IsRequired -->|是| RequestConfirm
    
    CheckMemory -->|是| NoApproval
    CheckMemory -->|否| RequestConfirm[请求用户确认]
    
    AlwaysConfirm --> GetChannel[获取渠道类型]
    RequestConfirm --> GetChannel
    
    GetChannel --> ChannelCheck{渠道类型?}
    
    ChannelCheck -->|CLI| CLIConfirm[CLI交互确认]
    ChannelCheck -->|WhatsApp/Feishu| MessageConfirm[发送确认消息]
    ChannelCheck -->|其他| NoHandler[无处理器，拒绝]
    
    CLIConfirm --> CLIWait[等待用户输入 Y/n]
    MessageConfirm --> MessageWait[等待用户回复 yes/no]
    
    CLIWait --> UserDecision{用户决策?}
    MessageWait --> UserDecision
    
    UserDecision -->|确认| ExecuteTool[执行工具]
    UserDecision -->|拒绝| RecordReject[记录拒绝]
    UserDecision -->|超时| TimeoutAction[超时处理]
    
    RecordReject --> ReturnReject[返回拒绝消息]
    TimeoutAction --> ReturnReject
    
    NoApproval --> ExecuteTool
    ExecuteDirect --> ExecuteTool
    
    ExecuteTool --> RecordMemory{是MEDIUM风险?}
    RecordMemory -->|是| UpdateMemory[更新会话记忆]
    RecordMemory -->|否| ReturnResult
    
    UpdateMemory --> ReturnResult[返回执行结果]
    
    ExecuteDirect --> ReturnResult
```

---

### CLI渠道详细流程

```mermaid
graph TD
    Start([Agent调用CLI工具]) --> NeedsConfirm{需要确认?}
    
    NeedsConfirm -->|否| Execute[直接执行]
    NeedsConfirm -->|是| PrepareMessage[准备确认消息]
    
    PrepareMessage --> FormatDisplay[格式化工具和参数]
    FormatDisplay --> ShowConfirm[显示确认对话框]
    
    ShowConfirm --> InquirerPrompt[使用inquirer.prompt]
    InquirerPrompt --> UserInput[等待用户输入]
    
    UserInput --> InputCheck{输入检查}
    
    InputCheck -->|Y/yes| Approved[确认执行]
    InputCheck -->|N/no| Rejected[拒绝执行]
    InputCheck -->|Ctrl+C| Cancel[取消操作]
    
    Approved --> Execute
    Rejected --> ReturnReject[返回拒绝消息]
    Cancel --> ReturnReject
    
    Execute --> CheckMedium{MEDIUM风险?}
    CheckMedium -->|是| CacheApproval[缓存到会话记忆]
    CheckMedium -->|否| ReturnSuccess
    
    CacheApproval --> ReturnSuccess[返回执行结果]
```

---

### 消息渠道详细流程

```mermaid
graph TD
    Start([Agent调用消息渠道工具]) --> NeedsConfirm{需要确认?}
    
    NeedsConfirm -->|否| Execute[直接执行]
    NeedsConfirm -->|是| GenerateID[生成确认ID]
    
    GenerateID --> FormatMessage[格式化确认消息]
    FormatMessage --> SendMessage[发送到用户设备]
    
    SendMessage --> CreatePromise[创建Promise]
    CreatePromise --> StartTimeout[启动超时计时器]
    
    StartTimeout --> StorePending[存储待处理确认]
    StorePending --> WaitForResponse[等待用户回复]
    
    WaitForResponse --> IncomingMessage[接收到消息]
    IncomingMessage --> IsApprovalMsg{是确认回复?}
    
    IsApprovalMsg -->|否| NormalProcess[正常消息处理]
    IsApprovalMsg -->|是| ParseResponse[解析回复内容]
    
    ParseResponse --> ResponseCheck{回复类型?}
    
    ResponseCheck -->|yes/y| ResolveTrue[Promise.resolve true]
    ResponseCheck -->|no/n| ResolveFalse[Promise.resolve false]
    
    ResolveTrue --> ClearTimeout[清除超时计时器]
    ResolveFalse --> ClearTimeout
    
    ClearTimeout --> RemovePending[移除待处理记录]
    RemovePending --> ExecuteCheck{执行决策}
    
    ExecuteCheck -->|确认| Execute
    ExecuteCheck -->|拒绝| ReturnReject[返回拒绝消息]
    
    Execute --> CheckMedium{MEDIUM风险?}
    CheckMedium -->|是| CacheApproval[缓存到会话记忆]
    CheckMedium -->|否| ReturnSuccess
    
    CacheApproval --> ReturnSuccess[返回执行结果]
    NormalProcess --> [继续正常流程]
    
    WaitForResponse --> TimeoutTrigger[超时触发]
    TimeoutTrigger --> RejectPromise[Promise.reject]
    RejectPromise --> ReturnTimeout[返回超时消息]
```

---

### 会话记忆管理流程

```mermaid
graph TB
    Start([工具执行请求]) --> GetRiskLevel{获取风险级别}
    
    GetRiskLevel -->|HIGH| AlwaysConfirm[总是确认]
    GetRiskLevel -->|LOW| SkipConfirm[跳过确认]
    GetRiskLevel -->|MEDIUM| GenerateKey[生成缓存键]
    
    AlwaysConfirm --> ConfirmFlow[进入确认流程]
    SkipConfirm --> ExecuteDirect[直接执行]
    
    GenerateKey --> KeyComponents[channel + chatId + toolName + params_hash]
    KeyComponents --> LookupMemory[查找记忆缓存]
    
    LookupMemory --> FoundEntry{找到记录?}
    
    FoundEntry -->|是| CheckTimestamp{时间戳检查}
    FoundEntry -->|否| ConfirmFlow
    
    CheckTimestamp --> WithinWindow{在时间窗口内?}
    
    WithinWindow -->|是| SkipConfirm
    WithinWindow -->|否| DeleteEntry[删除过期记录]
    
    DeleteEntry --> ConfirmFlow
    
    ConfirmFlow --> ApprovalResult{确认结果?}
    ApprovalResult -->|批准| RecordApproval[记录到记忆]
    ApprovalResult -->|拒绝| ReturnReject[返回拒绝]
    
    RecordApproval --> ExecuteDirect
    
    ExecuteDirect --> ReturnResult[返回结果]
```

---

### 集成到Agent主循环

```mermaid
graph LR
    User[用户消息] --> Agent[Agent主循环]
    Agent --> LLM[LLM生成工具调用]
    
    LLM --> ExecuteTool[executeTool回调]
    ExecuteTool --> ToolRegistry[ToolRegistry.execute]
    
    ToolRegistry --> CheckApproval{有确认管理器?}
    
    CheckApproval -->|否| Execute[执行工具]
    CheckApproval -->|是| NeedsApproval{needsApproval检查}
    
    NeedsApproval -->|无需| Execute
    NeedsApproval -->|需要| Request[requestApproval]
    
    Request --> CLI{CLI渠道?}
    Request --> Message{消息渠道?}
    
    CLI --> Inquirer[inquirer交互]
    Message --> BusMessage[消息总线发送]
    
    Inquirer --> UserConfirm{用户确认?}
    BusMessage --> UserConfirm
    
    UserConfirm -->|是| Execute
    UserConfirm -->|否| Reject[返回拒绝]
    
    Execute --> ToolResult[工具执行结果]
    ToolResult --> LLMReturn[返回给LLM]
    Reject --> LLMReturn
    
    LLMReturn --> NextStep[LLM继续下一步]
    NextStep --> FinalResponse[生成最终响应]
    FinalResponse --> User[发送给用户]
```

---

### 配置驱动决策流程

```mermaid
graph TD
    Start([工具执行]) --> LoadConfig[加载approval配置]
    
    LoadConfig --> ConfigEnabled{config.enabled?}
    ConfigEnabled -->|false| ExecuteDirect[直接执行]
    ConfigEnabled -->|true| CheckStrictMode{strictMode?}
    
    CheckStrictMode -->|true| AllRiskConfirm[所有非LOW风险确认]
    CheckStrictMode -->|false| NormalCheck[正常风险检查]
    
    AllRiskConfirm --> CheckOverride{有工具覆盖?}
    CheckOverride -->|是| UseOverride[使用覆盖配置]
    CheckOverride -->|否| RequestConfirm
    
    UseOverride --> OverrideValue{覆盖值?}
    OverrideValue -->|false| ExecuteDirect
    OverrideValue -->|true| RequestConfirm
    
    NormalCheck --> CheckOverride
    
    RequestConfirm --> ChannelHandler[调用渠道处理器]
    ChannelHandler --> HandlerResponse{处理器响应}
    
    HandlerResponse -->|true| ExecuteDirect
    HandlerResponse -->|false| ReturnReject
    
    ExecuteDirect --> ReturnResult[返回结果]
    ReturnReject --> ReturnReject[返回拒绝]
```

---

### 超时和错误处理流程

```mermaid
graph TD
    Start([请求确认]) --> CreatePromise[创建Promise]
    CreatePromise --> StartTimer[启动setTimeout]
    StartTimer --> RegisterHandler[注册处理器]
    
    RegisterHandler --> Waiting{等待响应}
    
    Waiting --> UserResponse[用户响应到达]
    Waiting --> Timeout[超时触发]
    Waiting --> Error[系统错误]
    
    UserResponse --> ProcessResponse[处理响应]
    ProcessResponse --> CleanupTimer[清除计时器]
    CleanupTimer --> CleanupHandler[清理处理器]
    CleanupHandler --> ResolvePromise[解决Promise]
    
    Timeout --> RejectTimeout[拒绝: 超时]
    Error --> RejectError[拒绝: 错误]
    
    RejectTimeout --> LogTimeout[记录超时日志]
    RejectError --> LogError[记录错误日志]
    
    LogTimeout --> ReturnFalse[返回false]
    LogError --> ReturnFalse
    
    ResolvePromise --> IsApproved{确认结果?}
    IsApproved -->|true| ReturnTrue[返回true]
    IsApproved -->|false| ReturnFalse
    
    ReturnTrue --> ExecuteTool[执行工具]
    ReturnFalse --> CancelTool[取消执行]
    
    ExecuteTool --> Success[成功]
    CancelTool --> Failed[失败]
```

---

### 流程说明

#### 关键决策点

1. **启用检查**: 配置`approval.enabled`是否为true
2. **风险级别**: 
   - LOW: 无需确认
   - MEDIUM: 首次确认，会话记忆
   - HIGH: 总是确认
3. **配置覆盖**: `toolOverrides`可覆盖默认策略
4. **渠道类型**: CLI使用inquirer，消息渠道使用回复
5. **超时处理**: 默认60秒，超时自动拒绝

#### 会话记忆机制

- 生成唯一键: `channel:chatId:toolName:params_hash`
- 时间窗口: 默认300秒(5分钟)
- 自动清理过期记录

#### 错误处理

- 超时: 自动拒绝，记录日志
- 错误: 捕获异常，返回false
- 用户中断(Ctrl+C): 视为拒绝