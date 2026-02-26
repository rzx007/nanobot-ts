# Nanobot 可视化监控平台 - 产品需求文档 (PRD)

**版本**: 1.0.0
**日期**: 2026-02-26
**作者**: Nanobot TypeScript 团队
**状态**: 草稿

---

## 1. 概述

### 1.1 产品目标

Nanobot 可视化监控平台是一个 Web 界面，用于实时监控和管理 Nanobot Agent 的运行状态，提升用户体验和系统可观测性。

### 1.2 产品愿景

为 Nanobot 提供一个现代化、易用的可视化界面，让用户能够：

- 📊 **实时监控**：查看 Agent 运行状态、消息吞吐、性能指标
- 🎛️ **便捷管理**：管理会话、配置、渠道，无需命令行
- 🔍 **深度洞察**：查看日志、工具调用、LLM 使用情况
- 🚨 **异常告警**：及时发现和处理系统异常
- 📈 **数据分析**：分析使用趋势和模式

### 1.3 设计原则

| 原则       | 说明                                            |
| ---------- | ----------------------------------------------- |
| **轻量级** | 遵循 Nanobot 轻量级理念，页面加载快，资源占用少 |
| **实时性** | WebSocket 实时推送状态更新，延迟 < 500ms        |
| **直观性** | 关键指标一目了然，可视化图表清晰                |
| **响应式** | 支持桌面和移动端访问                            |
| **模块化** | 功能模块独立，易于扩展                          |

---

## 2. 用户场景

### 2.1 用户角色

#### 角色 A: 个人使用者

**需求**：

- 监控 Agent 运行状态
- 查看最近的对话记录
- 查看错误日志
- 快速重启服务

**场景**：

1. 启动 gateway 后打开监控页面，确认各渠道连接正常
2. 发现 Agent 无响应，查看日志定位问题
3. 查看今日消息统计，了解使用情况

#### 角色 B: 开发者

**需求**：

- 监控系统性能指标
- 调试工具调用
- 测试新功能
- 修改配置

**场景**：

1. 开发新工具，通过监控页面查看工具调用结果
2. 分析 LLM 响应时间，优化 prompt
3. 修改 config.json 后在页面上重新加载配置
4. 查看 session 历史调试对话问题

#### 角色 C: 运维人员

**需求**：

- 监控资源使用情况
- 设置告警阈值
- 查看长期趋势
- 管理多个实例

**场景**：

1. 设置内存使用告警，超过阈值收到通知
2. 查看过去 7 天的消息趋势，评估系统负载
3. 批量管理多个 Nanobot 实例
4. 导出日志用于审计

---

## 3. 功能需求

### 3.1 核心功能 (MVP)

#### F1: 仪表盘 (Dashboard)

**优先级**: 🔴 高

展示系统核心指标和状态。

**内容**:

- ✅ 运行状态：🟢 在线 / 🔴 离线 / 🟡 启动中
- ✅ 渠道状态：WhatsApp/Feishu/Email/QQ/CLI 连接状态
- ✅ 实时指标：
  - 消息吞吐量 (msg/min)
  - 平均响应时间 (ms)
  - 活跃会话数
  - 错误率 (%)
- ✅ 今日统计：
  - 总消息数
  - 总 token 消耗
  - 工具调用次数
- ✅ 最近事件列表（最新 10 条）

**技术实现**:

- WebSocket 实时推送数据
- ECharts / Chart.js 可视化图表
- 每秒更新一次指标

**验收标准**:

- [ ] 页面加载时间 < 2s
- [ ] WebSocket 连接稳定，断开自动重连
- [ ] 所有指标数据准确无误
- [ ] 响应式布局，支持 1920x1080 和 1366x768

---

#### F2: 消息监控 (Message Monitor)

**优先级**: 🔴 高

实时查看入站/出站消息流。

**内容**:

- ✅ 消息列表（实时滚动）:
  - 时间戳
  - 渠道（WhatsApp/Feishu/Email/QQ/CLI）
  - 发送者
  - 消息内容（支持展开/折叠）
  - 状态（处理中/完成/失败）
- ✅ 筛选功能：
  - 按渠道筛选
  - 按发送者筛选
  - 按状态筛选
  - 按时间范围筛选
- ✅ 搜索功能：关键词搜索消息内容
- ✅ 消息详情：点击查看完整信息和工具调用记录

**技术实现**:

- WebSocket 推送新消息
- 虚拟滚动处理大量消息（保留最近 1000 条）
- 消息存储到内存或数据库

**验收标准**:

- [ ] 支持每秒 10+ 条消息流畅渲染
- [ ] 搜索响应时间 < 100ms
- [ ] 消息按时间倒序排列

---

#### F3: 会话管理 (Session Manager)

**优先级**: 🔴 高

管理用户会话，查看对话历史。

**内容**:

- ✅ 会话列表：
  - 会话 ID
  - 用户标识（渠道 + 用户 ID）
  - 最后活动时间
  - 消息数量
  - 状态（活跃/归档）
- ✅ 会话详情：
  - 对话历史（用户消息 + AI 回复）
  - 时间线视图
  - 工具调用记录
  - Token 使用统计
- ✅ 会话操作：
  - 查看详情
  - 清空会话
  - 归档会话
  - 删除会话
- ✅ 搜索会话：按用户 ID 搜索

**技术实现**:

- 读取 `~/.nanobot/workspace/sessions/*.jsonl`
- 显示会话历史
- 提供会话操作 API

**验收标准**:

- [ ] 支持加载 100+ 个会话
- [ ] 会话详情加载时间 < 1s
- [ ] 清空/归档操作即时生效

---

#### F4: 日志查看 (Logs Viewer)

**优先级**: 🔴 高

实时查看 Nanobot 系统日志。

**内容**:

- ✅ 日志流（实时滚动）:
  - 时间戳
  - 日志级别（INFO/WARN/ERROR）
  - 模块名称
  - 日志内容
- ✅ 筛选功能：
  - 按日志级别筛选
  - 按模块筛选
  - 按关键词搜索
  - 按时间范围筛选
- ✅ 日志导出：导出为文本文件
- ✅ 错误高亮：ERROR 级别日志红色高亮

**技术实现**:

- WebSocket 推送日志流
- Pino 日志库配置 WebSocket 传输
- 日志存储到文件用于导出

**验收标准**:

- [ ] 支持每秒 50+ 条日志流畅渲染
- [ ] 搜索响应时间 < 200ms
- [ ] 导出功能正常工作

---

#### F5: 渠道管理 (Channel Manager)

**优先级**: 🟡 中

管理各渠道的连接和状态。

**内容**:

- ✅ 渠道状态卡片：
  - WhatsApp：连接状态、二维码显示
  - Feishu：连接状态、错误信息
  - Email：连接状态、最后同步时间
  - QQ：连接状态、机器人信息
  - CLI：在线状态
- ✅ 渠道操作：
  - 断开连接
  - 重新连接
  - 查看详细日志
- ✅ 渠道配置预览：显示当前配置

**技术实现**:

- ChannelManager 暴露状态 API
- WebSocket 推送渠道状态更新
- 提供渠道操作 API

**验收标准**:

- [ ] 渠道状态实时更新
- [ ] 重连操作成功
- [ ] 二维码正确显示

---

#### F6: 配置管理 (Config Manager)

**优先级**: 🟡 中

查看和修改 Nanobot 配置。

**内容**:

- ✅ 配置预览：
  - 分页显示配置（Agent / Providers / Channels / Tools）
  - 敏感信息脱敏显示（API Key 显示前 4 位）
- ✅ 配置编辑：
  - JSON 编辑器（语法高亮）
  - 配置验证（Zod Schema）
  - 保存提示
- ✅ 配置操作：
  - 保存配置
  - 重启服务（可选）
  - 导出配置
  - 导入配置

**技术实现**:

- 读取 `~/.nanobot/config.json`
- Monaco Editor / CodeMirror 编辑器
- Zod Schema 验证

**验收标准**:

- [ ] JSON 语法高亮正确
- [ ] 保存前验证配置
- [ ] 重启服务成功

---

#### F7: 工具调用监控 (Tools Monitor)

**优先级**: 🟡 中

监控工具调用情况。

**内容**:

- ✅ 工具调用列表：
  - 工具名称
  - 调用时间
  - 参数
  - 执行时间
  - 结果状态（成功/失败）
- ✅ 工具统计：
  - 总调用次数
  - 成功率
  - 平均执行时间
  - Top 5 常用工具
- ✅ 工具详情：点击查看完整参数和结果

**技术实现**:

- ToolRegistry 记录每次调用
- WebSocket 推送调用事件
- 统计分析

**验收标准**:

- [ ] 工具调用记录完整
- [ ] 统计数据准确
- [ ] 支持查看调用历史

---

### 3.2 扩展功能 (Phase 2)

#### F8: 性能分析 (Performance Analytics)

**优先级**: 🟢 低

深入分析系统性能。

**内容**:

- 📊 性能图表：
  - 响应时间趋势
  - 消息吞吐量趋势
  - 错误率趋势
- 📊 LLM 使用分析：
  - Token 消耗趋势
  - 各模型使用比例
  - 成本估算
- 📊 资源使用：
  - CPU 使用率
  - 内存使用
  - 磁盘 I/O

---

#### F9: 告警系统 (Alert System)

**优先级**: 🟢 低

设置和接收告警。

**内容**:

- 🔔 告警规则：
  - 错误率超过阈值
  - 响应时间超过阈值
  - 渠道断开连接
  - 内存使用超过阈值
- 🔔 告警通知：
  - Web 页面通知
  - 邮件通知
  - Webhook 通知
- 🔔 告警历史：查看历史告警

---

#### F10: 多实例管理 (Multi-Instance)

**优先级**: 🟢 低

管理多个 Nanobot 实例。

**内容**:

- 🌐 实例列表：
  - 实例名称
  - 运行状态
  - 所在服务器
  - 最后更新时间
- 🌐 实例切换：点击切换查看不同实例
- 🌐 批量操作：批量重启、批量停止

---

## 4. 技术架构

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Web UI)                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │Dashboard│ │Sessions │ │  Logs   │ │ Channels│  │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│       └─────────────┼─────────────┼────────────┘     │
│                     │ WebSocket                    │
└─────────────────────┼───────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────┐
│                     ▼                               │
│              HTTP/WebSocket Server                    │
│         (Express / Hapi / Fastify)                   │
│                     │                               │
│         ┌───────────┼───────────┐                 │
│         ▼           ▼           ▼                 │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│   │ Events  │ │ Metrics  │ │  Logs   │           │
│   │  API    │ │  API    │ │  API    │           │
│   └────┬────┘ └────┬────┘ └────┬────┘           │
│        │           │           │                   │
│   ┌────┼───────────┼───────────┼────┐           │
│   │    ▼           ▼           ▼    │           │
│   │ ┌───────────────────────────┐ │           │
│   │ │   MessageBus (EventEmitter)│ │           │
│   │ └───────────┬───────────────┘ │           │
│   │             │                  │           │
│   │    ┌────────┼────────┐       │           │
│   │    ▼        ▼        ▼       │           │
│   │ ┌──────┐ ┌──────┐ ┌──────┐ │           │
│   │ │Agent │ │Tools │ │Channels│ │           │
│   │ └──────┘ └──────┘ └──────┘ │           │
│   └───────────────────────────────┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.2 前端技术栈

| 技术                 | 版本   | 用途             |
| -------------------- | ------ | ---------------- |
| **React**            | 18.x   | UI 框架          |
| **TypeScript**       | 5.x    | 类型安全         |
| **Vite**             | 5.x    | 构建工具         |
| **TailwindCSS**      | 3.x    | 样式框架         |
| **Socket.io-client** | 4.x    | WebSocket 客户端 |
| **ECharts**          | 5.x    | 图表库           |
| **Monaco Editor**    | latest | JSON 编辑器      |
| **React Router**     | 6.x    | 路由             |
| **Zustand**          | 4.x    | 状态管理         |
| **Day.js**           | latest | 日期处理         |
| **Lucide React**     | latest | 图标库           |

### 4.3 后端技术栈

| 技术            | 版本   | 用途               |
| --------------- | ------ | ------------------ |
| **Express**     | 4.x    | Web 服务器         |
| **Socket.io**   | 4.x    | WebSocket 服务     |
| **ws**          | 8.x    | WebSocket 原生支持 |
| **cors**        | latest | CORS 支持          |
| **helmet**      | latest | 安全头             |
| **compression** | latest | 响应压缩           |

### 4.4 目录结构

```
nanobot-ts/
├── src/
│   ├── ui/                          # 🆕 Web UI 模块
│   │   ├── server.ts                # Web 服务器入口
│   │   ├── routes/                  # HTTP 路由
│   │   │   ├── events.ts            # 事件 API
│   │   │   ├── metrics.ts           # 指标 API
│   │   │   ├── logs.ts             # 日志 API
│   │   │   ├── sessions.ts         # 会话 API
│   │   │   ├── channels.ts         # 渠道 API
│   │   │   ├── config.ts           # 配置 API
│   │   │   └── tools.ts            # 工具 API
│   │   ├── websocket/               # WebSocket 处理
│   │   │   ├── index.ts
│   │   │   ├── handler.ts
│   │   │   └── broadcaster.ts
│   │   └── middleware/             # 中间件
│   │       ├── auth.ts
│   │       ├── cors.ts
│   │       └── error.ts
│   │
│   └── ... (现有代码)
│
├── ui/                             # 🆕 前端代码（新目录）
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.tsx                # 入口文件
│   │   ├── App.tsx                 # 根组件
│   │   ├── pages/                  # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Messages.tsx
│   │   │   ├── Sessions.tsx
│   │   │   ├── Logs.tsx
│   │   │   ├── Channels.tsx
│   │   │   ├── Config.tsx
│   │   │   └── Tools.tsx
│   │   ├── components/             # 公共组件
│   │   │   ├── Layout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   └── LogViewer.tsx
│   │   ├── stores/                 # Zustand stores
│   │   │   ├── events.ts
│   │   │   ├── metrics.ts
│   │   │   ├── logs.ts
│   │   │   └── sessions.ts
│   │   ├── services/               # API 服务
│   │   │   ├── api.ts
│   │   │   └── websocket.ts
│   │   ├── types/                  # 类型定义
│   │   │   └── index.ts
│   │   ├── utils/                  # 工具函数
│   │   │   ├── format.ts
│   │   │   └── date.ts
│   │   └── styles/                 # 样式
│   │       └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── package.json
│
└── ... (现有文件)
```

---

## 5. API 设计

### 5.1 HTTP API

#### GET /api/status

获取系统状态。

**Response**:

```json
{
  "status": "online",
  "uptime": 3600,
  "version": "0.1.0",
  "channels": {
    "whatsapp": { "connected": true, "lastSync": "2026-02-26T10:00:00Z" },
    "feishu": { "connected": false, "error": "Connection timeout" },
    "email": { "connected": true, "lastSync": "2026-02-26T10:00:00Z" },
    "qq": { "connected": true, "lastSync": "2026-02-26T10:00:00Z" },
    "cli": { "connected": true }
  }
}
```

---

#### GET /api/metrics

获取实时指标。

**Response**:

```json
{
  "throughput": 10.5,
  "avgResponseTime": 450,
  "activeSessions": 5,
  "errorRate": 0.5,
  "today": {
    "totalMessages": 1500,
    "totalTokens": 50000,
    "toolCalls": 200
  },
  "llm": {
    "totalTokens": 50000,
    "promptTokens": 30000,
    "completionTokens": 20000
  }
}
```

---

#### GET /api/sessions

获取会话列表。

**Query**: `?page=1&limit=20&search=user_id`

**Response**:

```json
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "sessions": [
    {
      "id": "whatsapp:+1234567890",
      "channel": "whatsapp",
      "userId": "+1234567890",
      "lastActivity": "2026-02-26T10:00:00Z",
      "messageCount": 15,
      "status": "active"
    }
  ]
}
```

---

#### GET /api/sessions/:id

获取会话详情。

**Response**:

```json
{
  "id": "whatsapp:+1234567890",
  "channel": "whatsapp",
  "userId": "+1234567890",
  "createdAt": "2026-02-26T09:00:00Z",
  "lastActivity": "2026-02-26T10:00:00Z",
  "messages": [
    {
      "role": "user",
      "content": "Hello",
      "timestamp": "2026-02-26T09:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Hi! How can I help you?",
      "timestamp": "2026-02-26T09:00:01Z"
    }
  ],
  "toolCalls": [],
  "tokenUsage": { "prompt": 100, "completion": 50, "total": 150 }
}
```

---

#### DELETE /api/sessions/:id

删除会话。

**Response**: 204 No Content

---

#### GET /api/logs

获取日志列表。

**Query**: `?level=INFO&module=agent&search=error&from=2026-02-26T00:00:00Z&to=2026-02-26T23:59:59Z`

**Response**:

```json
{
  "logs": [
    {
      "timestamp": "2026-02-26T10:00:00Z",
      "level": "INFO",
      "module": "agent",
      "message": "Processing inbound message"
    }
  ]
}
```

---

#### GET /api/config

获取配置。

**Response**:

```json
{
  "agents": { "defaults": { "model": "openai:gpt-4o", ... } },
  "providers": { "openai": { "apiKey": "sk-****", ... } },
  "channels": { ... },
  "tools": { ... }
}
```

---

#### PUT /api/config

更新配置。

**Body**:

```json
{
  "agents": { "defaults": { "model": "anthropic:claude-3-5-sonnet" } }
}
```

**Response**:

```json
{ "success": true, "message": "Config updated" }
```

---

### 5.2 WebSocket API

#### Connection

```
ws://localhost:18790/ws
```

#### Events

##### 客户端订阅

```json
{
  "type": "subscribe",
  "channels": ["events", "logs", "metrics"]
}
```

##### 服务器推送 - 新消息事件

```json
{
  "type": "event",
  "data": {
    "kind": "inbound_message",
    "message": {
      "channel": "whatsapp",
      "senderId": "+1234567890",
      "content": "Hello",
      "timestamp": "2026-02-26T10:00:00Z"
    }
  }
}
```

##### 服务器推送 - 日志事件

```json
{
  "type": "log",
  "data": {
    "timestamp": "2026-02-26T10:00:00Z",
    "level": "INFO",
    "module": "agent",
    "message": "Processing inbound message"
  }
}
```

##### 服务器推送 - 指标更新

```json
{
  "type": "metrics",
  "data": {
    "throughput": 10.5,
    "avgResponseTime": 450,
    "activeSessions": 5,
    "errorRate": 0.5
  }
}
```

##### 服务器推送 - 渠道状态更新

```json
{
  "type": "channel_status",
  "data": {
    "channel": "whatsapp",
    "status": "connected",
    "timestamp": "2026-02-26T10:00:00Z"
  }
}
```

---

## 6. UI 设计

### 6.1 布局结构

```
┌────────────────────────────────────────────────────────┐
│  🤖 Nanobot    🟢 Online      [Admin ▼]  [🔔]   │ Header
├────────┬───────────────────────────────────────────────┤
│        │                                               │
│  📊   │  ┌─────────────────────────────────────────┐   │
│        │  │  📊 实时指标                             │   │
│  📈   │  ├─────────────────────────────────────────┤   │
│  📝   │  │  🟢 在线  |  消息: 10.5/min  |  错误  │   │
│  💬   │  │  ⏱️ 450ms  |  会话: 5 个      │ 0.5%  │   │
│        │  ├─────────────────────────────────────────┤   │
│  📋   │  │  📊 今日统计                             │   │
│  ⚙️   │  │  消息: 1,500  |  Token: 50,000      │   │
│        │  │  工具调用: 200 次                      │   │
│  🔧   │  └─────────────────────────────────────────┘   │
│        │                                               │
│  📞   │  ┌─────────────────────────────────────────┐   │
│        │  │  📞 渠道状态                             │   │
│  🔍   │  │  🟢 WhatsApp  |  🟢 Email  |  🟢 QQ │   │
│        │  │  🔴 Feishu    |  🟢 CLI                │   │
│  🚨   │  └─────────────────────────────────────────┘   │
│        │                                               │
│        │  ┌─────────────────────────────────────────┐   │
│        │  │  📝 最近事件 (10)                       │   │
│        │  │  [10:00] WhatsApp 收到消息            │   │
│        │  │  [09:59] Agent 处理完成              │   │
│        │  │  [09:58] LLM 调用 (gpt-4o)          │   │
│        │  │  [09:57] 工具调用: read_file         │   │
│        │  └─────────────────────────────────────────┘   │
│        │                                               │
└────────┴───────────────────────────────────────────────┘
 Sidebar             Main Content
```

### 6.2 配色方案

| 颜色               | 用途           | HEX                   |
| ------------------ | -------------- | --------------------- |
| **Primary**        | 主要按钮、链接 | `#3B82F6` (Blue-500)  |
| **Success**        | 在线状态、成功 | `#10B981` (Green-500) |
| **Warning**        | 启动中、警告   | `#F59E0B` (Amber-500) |
| **Error**          | 离线、错误     | `#EF4444` (Red-500)   |
| **Background**     | 背景色         | `#0F172A` (Slate-900) |
| **Surface**        | 卡片背景       | `#1E293B` (Slate-800) |
| **Text**           | 主要文字       | `#F1F5F9` (Slate-100) |
| **Text Secondary** | 次要文字       | `#94A3B8` (Slate-400) |

---

## 7. 开发计划

### Phase 1: MVP (2 周)

**目标**: 核心功能可用

**Week 1**:

- [ ] 搭建项目脚手架 (Vite + React + TypeScript)
- [ ] 设计 UI 布局和组件库
- [ ] 实现后端 WebSocket 服务器
- [ ] 实现仪表盘页面（状态、指标、事件）
- [ ] 实现消息监控页面

**Week 2**:

- [ ] 实现会话管理页面
- [ ] 实现日志查看页面
- [ ] 实现渠道管理页面
- [ ] 集成测试
- [ ] 修复 bug

**交付物**:

- ✅ 可用的 Web UI
- ✅ 核心监控功能完整
- ✅ 基础文档

---

### Phase 2: 完善 (1 周)

**目标**: 用户体验优化

**Week 3**:

- [ ] 实现配置管理页面
- [ ] 实现工具调用监控页面
- [ ] 优化性能（虚拟滚动、缓存）
- [ ] 增加响应式设计
- [ ] 编写用户文档

**交付物**:

- ✅ 完整的功能
- ✅ 良好的用户体验
- ✅ 完整的文档

---

### Phase 3: 高级功能 (可选)

**目标**: 高级分析和告警

**Week 4+**:

- [ ] 性能分析页面
- [ ] 告警系统
- [ ] 多实例管理
- [ ] 数据持久化（PostgreSQL / MongoDB）
- [ ] 用户认证和权限管理

---

## 8. 成功指标

| 指标                     | 目标           |
| ------------------------ | -------------- |
| **页面加载时间**         | < 2s           |
| **WebSocket 连接成功率** | > 99%          |
| **消息延迟**             | < 500ms        |
| **日志渲染性能**         | 支持 50+ 条/秒 |
| **会话加载时间**         | < 1s           |
| **用户满意度**           | > 4/5 星       |

---

## 9. 安全考虑

1. **认证**: 使用 API Key 或 JWT 认证
2. **CORS**: 限制允许的来源
3. **敏感信息**: API Key 脱敏显示
4. **日志脱敏**: 不记录敏感信息（密码、token）
5. **HTTPS**: 生产环境使用 HTTPS
6. **输入验证**: Zod Schema 验证所有输入

---

## 10. 技术债务

1. **日志存储**: 当前使用内存存储，后续需持久化
2. **指标采样**: 长期趋势需数据采样和聚合
3. **WebSocket 连接**: 需要优化断线重连逻辑
4. **性能优化**: 大量消息场景下需优化渲染性能
5. **测试覆盖**: 需要增加前端测试

---

## 11. 附录

### 11.1 参考项目

- **Grafana**: 监控面板设计参考
- **OpenClaw**: AI Agent 监控参考（具体功能待研究）
- **LobeChat**: AI 对话界面设计参考
- **Vercel Dashboard**: 现代化 UI 设计参考

### 11.2 相关文档

- Nanobot PRD: `docs/PRD.md`
- Nanobot API: `docs/API.md`
- Nanobot Architecture: `docs/ARCHITECTURE.md`

---

**最后更新**: 2026-02-26
