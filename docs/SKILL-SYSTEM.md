# Nanobot 技能系统文档

## 目录

- [概述](#概述)
- [核心概念](#核心概念)
- [技能格式](#技能格式)
- [核心组件](#核心组件)
- [Slash 命令](#slash-命令)
- [UI 组件](#ui-组件)
- [使用场景](#使用场景)
- [使用案例](#使用案例)
- [Agent 工具](#agent-工具)
- [调用过程](#调用过程)
- [架构设计](#架构设计)
- [API 参考](#api-参考)
- [技能仓库](#技能仓库)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

---

## 概述

Nanobot Skill(技能)系统是一个标准化的插件机制，允许开发者创建可重用的 AI 技能包，扩展 Agent 的能力。

### 核心特性

- ✅ **标准格式** - 基于 OpenCode 技能标准，使用 YAML Frontmatter
- ✅ **灵活配置** - 支持触发词、依赖检查、版本管理
- ✅ **自动加载** - Agent 可自动匹配和加载相关技能
- ✅ **远程发现** - 支持从 HTTP 仓库搜索和安装技能
- ✅ **智能匹配** - 基于触发关键词和描述的技能匹配
- ✅ **TUI 集成** - 完整的终端 UI 支持

### 工作原理

```
技能存储
  ↓
SkillLoader 扫描和解析
  ↓
技能加载到内存
  ↓
Agent 访问技能
  ↓
通过工具或 Slash 命令使用
```

---

## 核心概念

### 1. 技能 (Skill)

技能是一个包含专业知识、使用说明和示例的 Markdown 文件，遵循特定的 Frontmatter 格式。

**特点**：

- 文件名必须是 `SKILL.md`
- 位于 `workspace/skills/{skill-name}/` 目录
- 使用 YAML Frontmatter 定义元数据
- 可包含触发关键词、依赖项等信息

### 2. 触发关键词 (Triggers)

触发关键词是技能的一组关键词，用于 Agent 自动匹配相关技能。

**示例**：

```yaml
triggers:
  - AI SDK
  - generateText
  - streamText
  - tool calling
```

### 3. 技能工具 (Skill Tools)

Agent 可以使用的两个工具：

| 工具          | 功能                       |
| ------------- | -------------------------- |
| `load_skill`  | 显式加载指定技能的完整内容 |
| `match_skill` | 根据查询自动匹配相关技能   |

### 4. 技能仓库 (Skill Repository)

技能仓库是远程 HTTP 服务器，提供技能索引和文件下载。

**作用**：

- 提供技能索引 (`index.json`)
- 托管技能文件
- 支持搜索和安装

---

## 技能格式

### Frontmatter 规范

技能文件使用 YAML Frontmatter 定义元数据：

```yaml
---
name: ai-sdk
description: Answer questions about AI SDK and help build AI-powered features.
version: 1.0.0
author: OpenCode Team

triggers:
  - AI SDK
  - generateText
  - streamText

always: false

requires:
  bins:
    - node
    - npm
  env: []

metadata:
  category: development
  tags:
    - ai
    - llm
---
# 技能内容开始
```

### 必需字段

| 字段          | 类型   | 描述                             |
| ------------- | ------ | -------------------------------- |
| `name`        | string | 技能唯一标识符，必须与目录名一致 |
| `description` | string | 技能描述，用于匹配和展示         |

### 可选字段

| 字段            | 类型     | 默认值  | 描述                         |
| --------------- | -------- | ------- | ---------------------------- |
| `version`       | string   | `null`  | 技能版本号（语义化版本）     |
| `author`        | string   | `null`  | 技能作者                     |
| `triggers`      | string[] | `[]`    | 触发关键词列表，用于自动匹配 |
| `always`        | boolean  | `false` | 是否始终加载到系统提示词     |
| `requires.bins` | string[] | `[]`    | 必需的 CLI 工具              |
| `requires.env`  | string[] | `[]`    | 必需的环境变量               |
| `metadata`      | object   | `{}`    | 自定义元数据                 |

### 技能目录结构

```
workspace/skills/my-skill/
├── SKILL.md              # 主技能文件（必需）
├── examples/             # 示例文件（可选）
│   ├── basic.md
│   └── advanced.md
├── reference.md          # 参考文档（可选）
└── images/             # 图片资源（可选）
    └── diagram.png
```

---

## 核心组件

### 1. SkillLoader

**位置**：`src/core/skills.ts`

**职责**：

- 扫描 `workspace/skills/` 目录
- 解析技能 Frontmatter（使用 gray-matter）
- 检查技能依赖
- 构建技能摘要（用于系统提示词）
- 提供技能查询接口

**主要方法**：

```typescript
class SkillLoader {
  async init(): Promise<void>;
  getSkill(name: string): SkillInfo | null;
  getAllSkills(): SkillInfo[];
  getSkillNames(): string[];
  getAlwaysSkills(): SkillInfo[];
  buildSkillsSummary(): string;
  clear(): void;
}
```

### 2. SkillDiscoverer

**位置**：`src/core/skill-discovery.ts`

**职责**：

- 从远程 URL 获取技能索引
- 下载并安装技能
- 检查技能安装状态
- 卸载技能
- 清理缓存

**主要方法**：

```typescript
class SkillDiscoverer {
  async discover(url: string): Promise<SkillIndexEntry[]>;
  async install(skillName: string, baseUrl: string): Promise<void>;
  async isInstalled(skillName: string): Promise<boolean>;
  async uninstall(skillName: string): Promise<void>;
  async clearCache(): Promise<void>;
}
```

### 3. LoadSkillTool

**位置**：`src/tools/skill.ts`

**职责**：

- 允许 Agent 显式加载指定技能的完整内容

**参数**：

```typescript
{
  skillName: string; // 要加载的技能名称
}
```

### 4. MatchSkillTool

**位置**：`src/tools/skill.ts`

**职责**：

- 根据查询自动匹配最相关的技能

**参数**：

```typescript
{
  query: string;   // 查询内容
  limit?: number;  // 返回数量限制（默认 3）
}
```

---

## Slash 命令

### /skill

**描述**：使用指定技能（不指定名称则打开选择器）

**语法**：

```
/skill
/skill <skill-name>
```

**示例**：

```bash
# 打开技能选择器
/skill

# 直接选择技能
/skill ai-sdk
```

**功能**：

- 无参数：打开技能选择对话框
- 带参数：验证技能是否存在并提示用户

### /skills

**描述**：查看和管理已安装的技能

**语法**：

```
/skills
```

**功能**：

- 显示所有已安装技能
- 显示技能状态（Active/Inactive）
- 支持切换技能启用状态
- 支持查看技能详情
- 支持使用技能
- 支持刷新技能列表

**快捷键**：

- `↑↓` - 导航技能列表
- `Space` - 切换技能启用状态
- `Enter` - 查看技能详情
- `Shift+Enter` - 使用技能
- `R` - 刷新技能列表
- `Esc` - 关闭对话框

### /skill:find

**描述**：搜索并安装新技能

**语法**：

```
/skill:find
```

**功能**：

- 从远程仓库获取技能列表
- 显示技能名称、版本、作者等信息
- 支持键盘导航和安装
- 显示安装进度

**快捷键**：

- `↑↓` - 导航技能列表
- `Enter` - 安装技能
- `Esc` - 关闭对话框

---

## UI 组件

### 1. SkillsDialog

**位置**：`src/cli/tui/commands/dialogs/SkillsDialog.tsx`

**功能**：

- 显示已安装技能列表
- 显示技能状态
- 支持启用/禁用技能
- 支持查看技能详情
- 支持使用技能
- 支持刷新列表

**Props**：

```typescript
interface SkillsDialogProps {
  skills: SkillInfo[];
  onToggleSkill: (skillId: string, enabled: boolean) => void;
  onViewDetails?: (skillId: string) => void;
  onUseSkill?: (skillId: string) => void;
  onRefresh?: () => void;
}
```

### 2. SkillSelectDialog

**位置**：`src/cli/tui/commands/dialogs/SkillSelectDialog.tsx`

**功能**：

- 显示可用技能列表
- 支持键盘导航
- 支持选择技能

**Props**：

```typescript
interface SkillSelectDialogProps {
  skills: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  onSelect: (skillName: string) => void;
}
```

### 3. SkillFindDialog

**位置**：`src/cli/tui/commands/dialogs/SkillFindDialog.tsx`

**功能**：

- 显示远程技能列表
- 支持键盘导航
- 支持安装技能
- 显示安装进度

**Props**：

```typescript
interface SkillFindDialogProps {
  onSearch: (query: string) => Promise<SkillIndexEntry[]>;
  onInstall: (skill: any, baseUrl: string) => Promise<boolean>;
}
```

---

## 使用场景

### 场景 1：Agent 自动匹配技能

**场景描述**：用户提问涉及特定领域，Agent 自动识别需要使用哪个技能。

**操作流程**：

```
用户提问
  ↓
Agent 判断需要相关技能
  ↓
调用 match_skill 工具
  ↓
返回匹配的技能列表
  ↓
Agent 调用 load_skill 加载完整内容
  ↓
基于技能内容回答用户问题
```

**示例**：

```bash
用户: 如何使用 generateText 生成文本？

Agent: [自动调用 match_skill({ query: "generateText 生成文本" })]

系统: 1. **ai-sdk** (相关度: 80%)
      Answer questions about AI SDK and help build AI-powered features.

      提示：使用 load_skill({ skillName: "xxx" }) 加载完整技能内容。

Agent: [调用 load_skill({ skillName: "ai-sdk" })]

系统: [返回完整 AI SDK 技能内容]

Agent: 要使用 generateText 生成文本，你需要：
1. 导入 generateText 函数
2. 配置模型和提示词
3. 调用函数并处理结果
```

### 场景 2：用户显式选择技能

**场景描述**：用户明确知道要使用哪个技能，通过 Slash 命令选择。

**操作流程**：

```
用户执行 /skill
  ↓
打开技能选择对话框
  ↓
用户浏览技能列表
  ↓
选择目标技能
  ↓
系统提示技能已选择
  ↓
用户继续提问
  ↓
Agent 基于技能内容回答
```

**示例**：

```bash
用户: /skill

系统: [打开技能选择对话框]
      Select Skill
      > ai-sdk - Answer questions about AI SDK...
        opentui - Comprehensive OpenTUI skill...
        test-skill - 测试技能...

用户: [选择 ai-sdk 并按 Enter]

系统: 已选择 ai-sdk 技能，请继续提问...

用户: 如何使用 streamText？

Agent: [使用 ai-sdk 技能]
      要使用 streamText 实现流式输出：
      1. 导入 streamText 函数
      2. 配置模型和提示词
      3. 使用 async/await 处理流
```

### 场景 3：发现和安装新技能

**场景描述**：用户需要某个领域的新技能，从远程仓库搜索并安装。

**操作流程**：

```
用户执行 /skill:find
  ↓
打开技能搜索对话框
  ↓
自动加载所有可用技能
  ↓
用户浏览技能列表
  ↓
选择目标技能
  ↓
系统下载并安装技能
  ↓
提示安装成功
  ↓
用户刷新技能列表
  ↓
开始使用新技能
```

**示例**：

```bash
用户: /skill:find

系统: [打开技能搜索对话框]
      Search Skills
      > ai-sdk (1.0.0) by OpenCode Team
        Answer questions about AI SDK and help build AI-powered features.
      > opentui (1.2.0) by OpenCode Team
        Comprehensive OpenTUI skill for building terminal user interfaces.
      > agent-browser (1.0.0) by OpenCode Team
        Browser automation CLI for AI agents.

用户: [选择 ai-sdk 并按 Enter]

系统: Installing skill...
      下载：https://skills.opencode.ai/ai-sdk/SKILL.md
      下载：https://skills.opencode.ai/ai-sdk/examples/basic.md
      ...
      技能 "ai-sdk" 安装成功！请运行 /skills 刷新列表。

用户: /skills

系统: [显示更新后的技能列表，包含新安装的 ai-sdk]
```

### 场景 4：技能依赖检查

**场景描述**：技能需要特定的 CLI 工具或环境变量，系统自动检查。

**操作流程**：

```
用户查看技能列表
  ↓
系统检查每个技能的依赖
  ↓
标记技能为 Active 或 Inactive
  ↓
用户尝试使用 Inactive 技能
  ↓
系统提示缺失的依赖
```

**示例**：

```bash
用户: /skills

系统: Installed Skills (3/3)
      > docker-builder (2.1.0) - Inactive
        Docker 镜像构建和管理。
      > ai-sdk (1.0.0) - Active
        Answer questions about AI SDK and help build AI-powered features.
      > test-skill (1.0.0) - Active
        测试技能，用于验证技能加载和匹配功能。

用户: /skill docker-builder

系统: 错误：技能 "docker-builder" 依赖未满足
      缺失：CLI: docker
      请安装缺失的依赖后再试。

用户: [安装 docker CLI 后]

用户: /skill docker-builder

系统: 已选择 docker-builder 技能，请继续提问...
```

---

## 使用案例

### 案例 1：完整的技能使用流程

**目标**：使用 AI SDK 技能开发一个简单的 AI 应用。

**步骤**：

1. **搜索相关技能**

```bash
/skill:find

# 找到 ai-sdk 技能并安装
```

2. **刷新技能列表**

```bash
/skills

# 确认 ai-sdk 已安装并可用
```

3. **选择技能**

```bash
/skill ai-sdk

# 系统提示：已选择 ai-sdk 技能，请继续提问...
```

4. **提问使用**

```bash
# 提问：如何使用 generateText 生成文本？
```

5. **Agent 自动处理**

```
# Agent 自动调用：
# 1. match_skill({ query: "generateText 生成文本" })
# 2. load_skill({ skillName: "ai-sdk" })
# 3. 基于技能内容回答
```

### 案例 2：团队技能共享

**目标**：团队内部共享自定义技能。

**步骤**：

1. **创建内部技能仓库**

```
https://internal-skills.company.com/
├── index.json
├── company-ai/
│   └── SKILL.md
└── company-tools/
    └── SKILL.md
```

2. **团队成员安装技能**

```bash
/skill:find

# 系统从内部仓库加载技能
# 选择并安装 company-ai
```

3. **使用技能**

```bash
/skill company-ai

# 开始使用团队自定义技能
```

### 案例 3：技能开发和测试

**目标**：开发和测试新技能。

**步骤**：

1. **创建技能目录**

```bash
mkdir -p workspace/skills/my-skill
cd workspace/skills/my-skill
```

2. **编写 SKILL.md**

```yaml
---
name: my-skill
description: 我的新技能。
version: 1.0.0

triggers:
  - test
  - demo

always: false
---
# My Skill

这是一个测试技能...
```

3. **验证技能**

```bash
# 重启 nanobot 或刷新技能列表
/skills

# 确认技能已加载
```

4. **测试技能匹配**

```bash
# 提问：请测试一个功能

# Agent 自动调用 match_skill
# 应该匹配到 my-skill
```

---

## Agent 工具

### load_skill

**工具名称**：`load_skill`

**描述**：加载指定技能的完整内容到当前上下文

**使用场景**：

- 用户明确要求使用某个技能时
- Agent 判断需要特定技能的专业知识时

**参数**：

```typescript
{
  skillName: string; // 要加载的技能名称
}
```

**返回**：技能的完整 Markdown 内容

**示例**：

```typescript
// Agent 调用
load_skill({ skillName: 'ai-sdk' })
// 返回
`## Skill: ai-sdk (v1.0.0)

## Prerequisites

Before searching docs, check if node_modules/ai/docs/ exists...

## Quick Start

To use the AI SDK...

（完整技能内容）`;
```

### match_skill

**工具名称**：`match_skill`

**描述**：根据查询内容匹配最相关的技能

**使用场景**：

- 用户问题涉及特定领域但不确定使用哪个技能时
- 需要快速找到与当前任务相关的技能时

**参数**：

```typescript
{
  query: string;   // 查询内容
  limit?: number;  // 返回数量限制（默认 3）
}
```

**返回**：按相关度排序的技能列表

**示例**：

```typescript
// Agent 调用
match_skill({ query: '如何使用 generateText？' })
// 返回
`1. **ai-sdk** (v1.0.0) (相关度: 85%)
   Answer questions about AI SDK and help build AI-powered features.

2. **agent-tools** (v1.0.0) (相关度: 30%)
   Tool usage patterns and best practices.

提示：使用 load_skill({ skillName: "xxx" }) 加载完整技能内容。`;
```

**匹配算法**：

1. 触发关键词匹配（权重 0.8）
2. 技能名称匹配（权重 0.5）
3. 技能描述匹配（权重 0.3）
4. 综合评分，返回最高分的技能

---

## 调用过程

### 完整调用流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    用户交互层                              │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├─> /skill (选择技能）
                            │
                            ├─> /skills (管理技能）
                            │
                            └─> /skill:find (安装技能）
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Slash 命令处理层                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├─> SkillSelectHandler
                            ├─> SkillsHandler
                            └─> SkillFindHandler
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      UI 组件层                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├─> SkillsDialog
                            ├─> SkillSelectDialog
                            └─> SkillFindDialog
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      核心逻辑层                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├─> SkillLoader (本地技能）
                            └─> SkillDiscoverer (远程技能）
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Agent 运行时层                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ├─> LoadSkillTool
                            └─> MatchSkillTool
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      系统提示词层                           │
└─────────────────────────────────────────────────────────────────┘
                            │
                            └─> 技能摘要（buildSkillsSummary）
```

### 时序图：用户使用技能

```
用户         CLI        Handler       Dialog       Agent       SkillLoader
 |             |            |            |            |             |
 |-- /skill -->|            |            |            |             |
 |             |-- execute->|            |            |             |
 |             |            |-- openDialog>|             |             |
 |<-- Dialog --|            |            |             |             |
 |             |            |            |             |             |
 |-- 选择 ---->|------------>|            |             |             |
 |<-- 关闭 ----|------------>|            |             |             |
 |             |            |-- addUserMsg>|             |             |
 |             |            |            |-->          |             |
 |             |            |            |            |-- getSkill->|
 |             |            |            |            |<-- Skill --|
 |             |            |            |            |             |
 |             |            |            |<-- 响应 --------|             |
 |<-- 回答 ----|------------>|------------>|             |             |
```

### 时序图：Agent 自动匹配技能

```
用户         Agent       MatchSkill   SkillLoader  LoadSkill
 |             |           Tool         |            |
 |-- 提问 ---->|           |            |            |
 |             |-- matchSkill--->|            |             |
 |             |           |            |-- getAllSkills->|
 |             |           |            |<-- Skills ---|
 |             |           |<-- 匹配结果 ---|            |
 |             |<-- 技能列表 --|            |             |
 |             |           |            |             |
 |             |-- loadSkill--->|            |             |
 |             |           |            |-- getSkill->|
 |             |           |            |<-- Skill ---|
 |             |           |<-- 技能内容 ---|            |
 |             |           |            |             |
 |             |<-- 基于技能回答 ------------------------|
 |<-- 最终答案 ------------------------------------------|
```

---

## 架构设计

### 模块结构

```
nanobot-ts/
├── src/
│   ├── core/
│   │   ├── skills.ts              # SkillLoader - 本地技能管理
│   │   ├── skill-discovery.ts     # SkillDiscoverer - 远程技能发现
│   │   └── context.ts            # ContextBuilder - 系统提示词构建
│   │
│   ├── tools/
│   │   └── skill.ts             # LoadSkillTool, MatchSkillTool
│   │
│   ├── cli/
│   │   ├── tui/
│   │   │   └── commands/
│   │   │       ├── handlers/
│   │   │       │   ├── SkillsHandler.ts
│   │   │       │   ├── SkillSelectHandler.ts
│   │   │       │   └── SkillFindHandler.ts
│   │   │       └── dialogs/
│   │   │           ├── SkillsDialog.tsx
│   │   │           ├── SkillSelectDialog.tsx
│   │   │           └── SkillFindDialog.tsx
│   │   │
│   │   └── setup.ts              # AgentRuntime 构建和工具注册
│   │
│   └── config/
│       └── schema.ts             # 配置架构
│
└── workspace/
    └── skills/
        ├── ai-sdk/
        │   └── SKILL.md
        ├── opentui/
        │   └── SKILL.md
        └── ...
```

### 数据流

```
技能加载流程：
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ workspace/  │ -> │ SkillLoader │ -> │ Agent       │
│ skills/     │    │             │    │ Runtime     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └─ SKILL.md ──────┴─ SkillInfo ───────┴─ Tools

技能发现流程：
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Remote      │ -> │SkillDiscoverer| -> │ workspace/  │
│ Repository  │    │             │    │ skills/     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └─ index.json ─────┴─ download ───────┴─ install
```

### 错误处理流程

```
┌─────────────┐
│   用户请求   │
└──────┬──────┘
       │
       ├─> 1. 参数验证
       │       ├─> 成功 ──> 2. 执行
       │       └─> 失败 ──> 返回错误消息
       │
       ├─> 2. 执行
       │       ├─> 成功 ──> 3. 返回结果
       │       └─> 失败 ──> 错误处理
       │
       └─> 3. 错误处理
               ├─> 记录日志
               ├─> 返回用户友好的错误消息
               └─> 回滚或清理资源
```

---

## API 参考

### SkillLoader

#### 构造函数

```typescript
constructor(config: Config);
```

#### 方法

##### init()

初始化技能加载器，扫描并加载所有技能。

```typescript
async init(): Promise<void>;
```

**示例**：

```typescript
const loader = new SkillLoader(config);
await loader.init();
console.log(`Loaded ${loader.getSkillNames().length} skills`);
```

---

##### getSkill(name: string)

获取指定技能。

```typescript
getSkill(name: string): SkillInfo | null;
```

**参数**：

- `name` - 技能名称

**返回**：`SkillInfo | null`

**示例**：

```typescript
const skill = loader.getSkill('ai-sdk');
if (skill) {
  console.log(skill.description);
  console.log(skill.content);
}
```

---

##### getAllSkills()

获取所有技能。

```typescript
getAllSkills(): SkillInfo[];
```

**返回**：`SkillInfo[]`

**示例**：

```typescript
const skills = loader.getAllSkills();
skills.forEach(skill => {
  console.log(`${skill.name}: ${skill.description}`);
});
```

---

##### getSkillNames()

获取所有技能名称。

```typescript
getSkillNames(): string[];
```

**返回**：`string[]`

**示例**：

```typescript
const names = loader.getSkillNames();
console.log('Available skills:', names.join(', '));
```

---

##### getAlwaysSkills()

获取 `always: true` 的技能。

```typescript
getAlwaysSkills(): SkillInfo[];
```

**返回**：`SkillInfo[]`

**示例**：

```typescript
const alwaysSkills = loader.getAlwaysSkills();
console.log('Always loaded skills:', alwaysSkills.length);
```

---

##### buildSkillsSummary()

构建技能摘要，用于系统提示词。

```typescript
buildSkillsSummary(): string;
```

**返回**：`string` (XML 格式)

**示例**：

```typescript
const summary = loader.buildSkillsSummary();
console.log(summary);
/*
<skills>
  <skill available="true">
    <name>ai-sdk</name>
    <description>Answer questions about AI SDK...</description>
    <location>/workspace/skills/ai-sdk/SKILL.md</location>
    <triggers>AI SDK, generateText, streamText</triggers>
  </skill>
  ...
</skills>
*/
```

---

### SkillDiscoverer

#### 构造函数

```typescript
constructor(config: Config);
```

#### 方法

##### discover(url: string)

从远程 URL 获取技能索引。

```typescript
async discover(url: string): Promise<SkillIndexEntry[]>;
```

**参数**：

- `url` - 技能仓库的 URL

**返回**：`Promise<SkillIndexEntry[]>`

**示例**：

```typescript
const discoverer = new SkillDiscoverer(config);
const skills = await discoverer.discover('https://skills.opencode.ai');
console.log(`Found ${skills.length} skills`);
```

---

##### install(skillName: string, baseUrl: string)

下载并安装指定技能。

```typescript
async install(skillName: string, baseUrl: string): Promise<void>;
```

**参数**：

- `skillName` - 要安装的技能名称
- `baseUrl` - 技能仓库的基础 URL

**返回**：`Promise<void>`

**示例**：

```typescript
try {
  await discoverer.install('ai-sdk', 'https://skills.opencode.ai/');
  console.log('安装成功');
} catch (error) {
  console.error('安装失败:', error.message);
}
```

---

##### isInstalled(skillName: string)

检查技能是否已安装。

```typescript
async isInstalled(skillName: string): Promise<boolean>;
```

**参数**：

- `skillName` - 技能名称

**返回**：`Promise<boolean>`

**示例**：

```typescript
const installed = await discoverer.isInstalled('ai-sdk');
if (installed) {
  console.log('技能已安装');
}
```

---

##### uninstall(skillName: string)

卸载指定技能。

```typescript
async uninstall(skillName: string): Promise<void>;
```

**参数**：

- `skillName` - 技能名称

**返回**：`Promise<void>`

**示例**：

```typescript
try {
  await discoverer.uninstall('ai-sdk');
  console.log('卸载成功');
} catch (error) {
  console.error('卸载失败:', error.message);
}
```

---

##### clearCache()

清理缓存目录。

```typescript
async clearCache(): Promise<void>;
```

**返回**：`Promise<void>`

**示例**：

```typescript
await discoverer.clearCache();
console.log('缓存已清理');
```

---

### 数据类型

#### SkillInfo

```typescript
interface SkillInfo {
  name: string; // 技能名称
  path: string; // 技能路径
  content: string; // 技能内容
  description?: string; // 描述
  version?: string; // 版本号
  author?: string; // 作者
  triggers?: string[]; // 触发关键词
  available?: boolean; // 是否可用
  _frontmatter?: Record<string, unknown>; // 原始 Frontmatter
}
```

#### SkillIndexEntry

```typescript
interface SkillIndexEntry {
  name: string; // 技能名称
  description: string; // 技能描述
  files: string[]; // 技能文件列表
  version?: string; // 版本号
  author?: string; // 作者
}
```

---

## 技能仓库

### 本地仓库

**位置**：`workspace/skills/`

**结构**：

```
workspace/skills/
├── ai-sdk/
│   └── SKILL.md
├── opentui/
│   ├── SKILL.md
│   └── reference.md
└── test-skill/
    └── SKILL.md
```

### 远程仓库

**示例**：`https://skills.opencode.ai`

**结构**：

```
https://skills.opencode.ai/
├── index.json
├── ai-sdk/
│   ├── SKILL.md
│   ├── examples/
│   │   ├── basic.md
│   │   └── advanced.md
│   └── reference.md
└── opentui/
    ├── SKILL.md
    └── reference.md
```

### index.json 格式

```json
{
  "skills": [
    {
      "name": "ai-sdk",
      "description": "Answer questions about AI SDK...",
      "version": "1.0.0",
      "author": "OpenCode Team",
      "files": ["SKILL.md", "examples/basic.md", "reference.md"]
    }
  ]
}
```

---

## 最佳实践

### 1. 技能编写

#### ✅ 推荐

**清晰的技能名称**：

```yaml
name: ai-sdk # 清晰、简短、有意义的名称
```

**详细的技能描述**：

```yaml
description: Answer questions about AI SDK. Use when: (1) building AI apps, (2) using generateText/streamText, (3) implementing tool calling.
```

**合理的触发关键词**：

```yaml
triggers:
  - AI SDK
  - generateText
  - streamText
  - tool calling
  # 具体的、有意义的触发词
```

**完整的依赖声明**：

```yaml
requires:
  bins:
    - node # 明确列出所有需要的 CLI 工具
    - npm
  env:
    - OPENAI_API_KEY # 列出所有需要的环境变量
```

#### ❌ 避免

**模糊的名称**：

```yaml
name: helper # 不明确
```

**简化的描述**：

```yaml
description: A skill for development. # 太简单
```

**过多的触发词**：

```yaml
triggers:
  - ai
  - sdk
  - generate
  - text
  - stream
  # 太通用，容易误匹配
```

---

### 2. 技能组织

#### ✅ 推荐

**模块化技能文件**：

```
my-skill/
├── SKILL.md           # 主要内容
├── examples/          # 示例
│   ├── basic.md
│   └── advanced.md
└── reference.md       # API 参考
```

**清晰的目录结构**：

```
workspace/skills/
├── development/       # 开发相关技能
│   ├── ai-sdk/
│   └── opentui/
├── devops/           # DevOps 技能
│   └── docker/
└── data/             # 数据处理技能
    └── scraping/
```

#### ❌ 避免

**所有内容在一个文件**：

```markdown
<!-- SKILL.md 包含几千行内容 -->
```

**混乱的文件组织**：

```
my-skill/
├── SKILL.md
├── README.md
├── doc1.md
├── doc2.md
└── ...
```

---

### 3. 用户体验

#### ✅ 推荐

**提供使用示例**：

```markdown
## 使用示例

### 示例 1：基本用法

\`\`\`typescript
import { generateText } from 'ai';

const result = await generateText({
model: openai('gpt-4'),
prompt: 'Hello, world!'
});
\`\`\`
```

**清晰的错误提示**：

```typescript
if (skill.available === false) {
  const missing = this._getMissingRequirements(skill);
  return `错误：技能 "${skillName}" 依赖未满足\n缺失：${missing}`;
}
```

**提供后续操作指导**：

```typescript
addSystemMessage(`技能 "${skill.name}" 安装成功！\n\n` + `请运行 /skills 刷新列表。`);
```

---

### 4. 性能优化

#### ✅ 推荐

**延迟加载技能**：

```typescript
// 只在需要时加载完整内容
const summary = loader.buildSkillsSummary(); // 仅摘要
const skill = loader.getSkill('ai-sdk'); // 按需加载
```

**缓存技能索引**：

```typescript
class SkillDiscoverer {
  private cache = new Map<string, SkillIndexEntry[]>();

  async discover(url: string): Promise<SkillIndexEntry[]> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    const skills = await fetchIndex(url);
    this.cache.set(url, skills);
    return skills;
  }
}
```

**并发下载**：

```typescript
await Promise.all(
  skill.files.map(async file => {
    await downloadFile(file);
  }),
);
```

---

## 故障排除

### 问题 1：技能无法加载

**症状**：

```
技能列表为空
```

**可能原因**：

1. 技能文件格式错误
2. Frontmatter 解析失败
3. 目录名称不匹配

**解决方法**：

```bash
# 1. 检查技能文件
ls -la workspace/skills/

# 2. 检查 SKILL.md 格式
cat workspace/skills/ai-sdk/SKILL.md | head -20

# 3. 验证 YAML 格式
npm install -g yamljs
yaml2json workspace/skills/ai-sdk/SKILL.md

# 4. 检查目录名称
# 确保目录名称与 Frontmatter 中的 name 一致
```

---

### 问题 2：Agent 无法匹配技能

**症状**：

```
match_skill 返回 "未找到匹配的技能"
```

**可能原因**：

1. 触发关键词设置不合理
2. 查询与技能描述不匹配
3. 评分算法需要调整

**解决方法**：

```bash
# 1. 检查触发关键词
cat workspace/skills/ai-sdk/SKILL.md | grep -A 10 "triggers:"

# 2. 优化触发关键词
# 添加更具体的、有意义的触发词

# 3. 测试匹配
# 在对话中测试不同查询
```

---

### 问题 3：远程技能安装失败

**症状**：

```
安装失败：Failed to download SKILL.md: 404
```

**可能原因**：

1. 技能仓库 URL 错误
2. 技能文件不存在
3. 网络连接问题

**解决方法**：

```bash
# 1. 检查仓库 URL
curl -I https://skills.opencode.ai/index.json

# 2. 验证文件存在
curl -I https://skills.opencode.ai/ai-sdk/SKILL.md

# 3. 检查网络连接
ping skills.opencode.ai

# 4. 查看详细日志
nanobot --log-level=debug
```

---

### 问题 4：技能依赖未满足

**症状**：

```
错误：技能 "xxx" 依赖未满足
```

**可能原因**：

1. 缺少 CLI 工具
2. 环境变量未设置
3. 权限不足

**解决方法**：

```bash
# 1. 安装缺失的 CLI 工具
npm install -g docker
npm install -g git

# 2. 设置环境变量
export OPENAI_API_KEY="your-api-key"

# 3. 验证工具安装
which docker
which git

# 4. 重启 nanobot
nanobot /skills
```

---

## 附录

### A. 配置文件

#### nanobot.config.json

```json
{
  "agents": {
    "defaults": {
      "workspace": "~/workspace"
    }
  }
}
```

### B. 环境变量

```bash
# 工作区目录
export NANOBOT_WORKSPACE="~/workspace"

# 技能仓库 URL（可选）
export NANOBOT_SKILL_REPO="https://skills.opencode.ai"

# 缓存目录（可选）
export NANOBOT_CACHE_DIR="~/.nanobot/cache"
```

### C. 日志级别

```typescript
// DEBUG - 详细调试信息
logger.debug(`Loading skill: ${skillName}`);

// INFO - 一般操作信息
logger.info(`Skill "${skillName}" installed successfully`);

// WARN - 警告信息
logger.warn(`Skill "${skillName}" has missing dependencies`);

// ERROR - 错误信息
logger.error(`Failed to load skill: ${error}`);
```

---

## 更新日志

### v1.0.0 (2026-03-04)

- ✅ 初始版本
- ✅ 实现 SkillLoader（gray-matter 解析）
- ✅ 实现 SkillDiscoverer（远程发现）
- ✅ 实现 LoadSkillTool 和 MatchSkillTool
- ✅ 实现 /skill、/skills、/skill:find 命令
- ✅ 实现 SkillsDialog、SkillSelectDialog、SkillFindDialog UI
- ✅ 支持触发关键词自动匹配
- ✅ 支持依赖检查

---

## 相关资源

- [Nanobot 主文档](../README.md)
- [远程技能发现文档](./REMOTE-SKILL-DISCOVERY.md)
- [Agent 配置](./AGENT-CONFIG.md)
- [OpenCode 技能仓库](https://skills.opencode.ai)
- [OpenCode 技能标准](https://github.com/anomalyco/opencode/tree/dev/.agents/skills)

---

**文档版本**：1.0.0  
**最后更新**：2026-03-04
