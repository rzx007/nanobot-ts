# 飞书渠道配置指南

本文介绍如何在 Nanobot-TS 中配置飞书（Feishu）渠道，实现通过飞书接收用户消息并回复。

## 技术说明

- **SDK**：`@larksuiteoapi/node-sdk`
- **接收消息**：WebSocket 长连接（无需公网 IP、内网穿透）
- **发送消息**：飞书开放平台 HTTP API

## 一、前置条件

- 使用 **飞书开放平台（中国）** 创建应用：<https://open.feishu.cn/app>（国际版 Lark 长连接支持不同，本文以飞书为准）
- 应用类型须为 **企业自建应用**
- 本机可访问公网（能连上 `open.feishu.cn`）

## 二、开发者后台配置

### 2.1 创建自建应用

1. 登录 [飞书开发者后台](https://open.feishu.cn/app)
2. 进入「创建企业自建应用」
3. 填写应用名称、描述等，创建后进入应用详情

### 2.2 添加机器人能力

1. 在应用详情中打开「应用能力」→「机器人」
2. 启用「机器人」能力
3. 配置权限（在「权限管理」中申请并开通）：
   - `im:message` — 获取与发送消息
   - `im:message:send_as_bot` — 以应用身份发消息
   - `im:message.group_at_msg` — 接收群聊 @ 消息（可选，需群聊时开通）
   - `im:message.p2p_msg` — 接收单聊消息

### 2.3 获取凭证

在应用详情 **「凭证与基础信息」** 中获取：

- **App ID**
- **App Secret**

后续填入 `config.json` 的 `channels.feishu`。

### 2.4 事件订阅（长连接模式）

1. 进入 **「事件与回调」**
2. **订阅方式**：
   - 选择 **「使用长连接接收事件」**
   - ⚠️ **保存前必须先建立长连接**（见下方「启动顺序」）
3. **事件配置**：
   - 添加事件：**「接收消息」**（`im.message.receive_v1`）

### 2.5 发布与可用范围

- 开发阶段：在「版本管理与发布」中可创建版本并发布为「仅企业内可用」或「仅开发者可用」
- 若保存长连接时提示需先发布，则先完成一次「创建版本」并「发布」

## 三、本地配置（config.json）

配置文件默认路径：`~/.nanobot/config.json`（Windows 为 `%USERPROFILE%\.nanobot\config.json`）。

在 `channels.feishu` 中填写：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "你的 App ID",
      "appSecret": "你的 App Secret",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": []
    }
  }
}
```

### 配置项说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `enabled` | 是 | 是否启用飞书渠道，设为 `true` |
| `appId` | 是 | 飞书应用 App ID（开发者后台-凭证与基础信息） |
| `appSecret` | 是 | 飞书应用 App Secret |
| `encryptKey` | 否 | 长连接模式下可不填；Webhook 模式需填「事件与回调」中的加密密钥 |
| `verificationToken` | 否 | 长连接模式下可不填；Webhook 验签用 |
| `allowFrom` | 否 | 允许的用户 ID 列表，为空表示不限制；填则只处理这些用户的消息 |

### 限制消息来源（allowFrom）

若只允许特定用户或机器人发消息，可配置 `allowFrom`（飞书用户 ID，如 `ou_xxx`）：

```json
"allowFrom": ["ou_xxxxxx", "ou_yyyyyy"]
```

留空 `[]` 表示不按用户过滤。

## 四、启动顺序（重要）

长连接模式下，**必须先启动 Gateway 并成功建连，再在开发者后台保存「使用长连接接收事件」**。

1. **启动 Gateway**：
   ```bash
   pnpm run dev -- gateway
   # 或
   node dist/cli/run.js gateway
   ```
2. 等待日志出现：
   - `Feishu channel started (WebSocket)`
   - `[info]: [ '[ws]', 'ws client ready' ]`
3. **保持该进程运行**，再打开飞书开发者后台
4. 在「事件与回调」→「订阅方式」中选择「使用长连接接收事件」并保存

若未先建连就保存，会提示「应用未建立长连接」。

## 五、使用方式

1. 在飞书中将机器人加入目标群聊，或与机器人发起私聊
2. 在群内 @ 机器人或私聊发送文本消息
3. Nanobot 会通过飞书渠道接收消息并回复（由 Agent 逻辑决定是否自动回复）

当前实现仅处理 **纯文本** 消息；图片、富文本等会忽略。

## 六、常见问题

### 1. 保存时提示「应用未建立长连接」

- 先启动 `gateway`，等出现 `ws client ready` 后再在后台保存
- 确认 `appId`、`appSecret` 与当前应用一致
- 确认应用是飞书（中国）自建应用，且本机可访问 `open.feishu.cn`

### 2. 收不到消息

- 确认后台「事件与回调」已选「使用长连接」且已添加 `im.message.receive_v1`
- 确认机器人已加入对应群聊或用户已与机器人私聊过
- 若配置了 `allowFrom`，确认发送者 ID 在列表中
- 仅文本消息会被处理，非文本会被忽略

### 3. 国际版 Lark（open.larksuite.com）

国际版 Lark 对长连接支持可能不同。若无法使用长连接，可改用 **Webhook 模式**（将事件发送至开发者服务器），并自行实现 HTTP 回调与验签（需公网可访问的 URL）。

### 4. 调试日志

需要更详细连接与事件日志时，可在代码中临时将 Feishu 的 `loggerLevel` 改为 `lark.LoggerLevel.debug`（或参考 SDK 文档），便于排查连接与收包问题。

## 七、参考链接

- [飞书开放平台 - 使用长连接接收事件](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/subscribe-to-events-via-websocket)
- [接收消息事件](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/events/receive)
- [@larksuiteoapi/node-sdk](https://www.npmjs.com/package/@larksuiteoapi/node-sdk)
