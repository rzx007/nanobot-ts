# nanobot-ts 项目文档更新记录

## 更新日期

2026-02-25

## 更新内容

### 1. 修正 Feishu SDK 引用

**问题**: 原文档中使用的是不存在的 `lark-oapi` 包名。

**修正**: 将所有 `lark-oapi` 替换为正确的官方 SDK 包名 `@larksuiteoapi/node-sdk`。

**更新文件**:

1. **package.json**
   ```diff
   - "lark-oapi": "^1.5.0",
   + "@larksuiteoapi/node-sdk": "^1.0.0",
   ```

2. **docs/DEVELOPMENT-PLAN.md**
   - 第 182 行: 渠道依赖表格
     ```diff
     - | **Feishu** | `lark-oapi` | 官方 Feishu SDK |
     + | **Feishu** | `@larksuiteoapi/node-sdk` | 官方 Feishu SDK |
     ```
   - 第 906 行: 技术栈说明
     ```diff
     - **技术栈**: `lark-oapi`
     + **技术栈**: `@larksuiteoapi/node-sdk`
     ```
   - 第 917 行: import 语句示例
     ```diff
     - import * as lark from '@larksuiteoapi/lark-oapi';
     + import * as lark from '@larksuiteoapi/node-sdk';
     ```

3. **docs/PRD.md**
   - 第 45 行: 技术选型表格
     ```diff
     - | **Feishu** | lark-oapi | 官方 TypeScript SDK |
     + | **Feishu** | @larksuiteoapi/node-sdk | 官方 TypeScript SDK |
     ```
   - 第 183 行: 目标渠道说明
     ```diff
     - - **Feishu/Lark** (优先级: 高) - 使用 lark-oapi 官方 SDK
     + - **Feishu** (优先级: 高) - 使用 @larksuiteoapi/node-sdk 官方 SDK |
     ```
   - 第 337 行: 项目结构
     ```diff
     - │   ├── feishu.ts          # Feishu (lark-oapi)
     + │   ├── feishu.ts          # Feishu (@larksuiteoapi/node-sdk)
     ```

### 2. 移除 QQ 渠道集成

**原因**: `botpy-ts` 这个库不存在，决定移除 QQ 渠道集成。

**更新文件**:

1. **package.json**
   ```diff
   - "botpy-ts": "^1.2.0",
   ```

2. **docs/PRD.md**
   - 第 28 行: 目标渠道说明
     ```diff
     - - **目标渠道**（按优先级）：
       - **WhatsApp** (优先级: 高) - 使用 Baileys 库
       - **Feishu/Lark** (优先级: 高) - 使用 @larksuiteoapi/node-sdk 官方 SDK
       - **Email** (优先级: 中) - 使用 imapflow + nodemailer
       - **QQ** (优先级: 中) - 使用 botpy-ts 官方 SDK
       - **CLI** (优先级: 高) - 直接命令行交互
     + - **目标渠道**（按优先级）：
       - **WhatsApp** (优先级: 高) - 使用 Baileys 库
       - **Feishu** (优先级: 高) - 使用 @larksuiteoapi/node-sdk 官方 SDK
       - **Email** (优先级: 中) - 使用 imapflow + nodemailer
       - **CLI** (优先级: 高) - 直接命令行交互
     ```
   - 移除 QQ 渠道引用
     ```diff
     - [ ] WhatsApp 渠道（Baileys）
     - [ ] Feishu 渠道（@larksuiteoapi/node-sdk）
     - [ ] Email 渠道（imapflow + nodemailer）
     - [ ] QQ 渠道（botpy-ts）
     + - [ ] WhatsApp 渠道（Baileys）
     + [ ] Feishu 渠道（@larksuiteoapi/node-sdk）
     + [ ] Email 渠道（imapflow + nodemailer）
     ```

3. **docs/API.md**
   - 移除目录中的 QQ Channel 链接和所有 QQ 相关内容
   - 移除配置中的 QQConfig 引用

4. **docs/DEVELOPMENT-PLAN.md**
   - 使用 sed 移除所有 QQ 相关行

## 完成状态

✅ package.json - 已移除 botpy-ts，保留 3 个渠道（WhatsApp, Feishu, Email）
✅ docs/PRD.md - 已更新 Feishu SDK 引用，移除 QQ 渠道
✅ docs/DEVELOPMENT-PLAN.md - 已移除 QQ 渠道相关内容
✅ docs/API.md - 已重写，移除 QQ Channel API 文档

## 下一步建议

1. 开始实现核心基础设施
   - Message Bus (消息总线）
   - Events (事件类型）
   - Config (配置管理，使用 Zod）

2. 实现基础工具系统
   - Tool 基类
   - ToolRegistry（工具注册表）
   - 文件系统工具
   - Shell 执行工具

3. 实现 LLM Provider 集成
   - 使用 @ai-sdk 统一接口
   - 支持 OpenAI, Anthropic, OpenRouter 等

4. 实现 Agent Loop 核心逻辑
   - 消息处理循环
   - 工具调用机制
   - 上下文构建

5. 实现 CLI 渠道
   - 交互式命令行界面
   - 命令参数解析

6. 逐个实现消息渠道
   - CLI (最简单，优先实现）
   - Feishu (使用 @larksuiteoapi/node-sdk)
   - WhatsApp (使用 baileys)
   - Email (imapflow + nodemailer)
