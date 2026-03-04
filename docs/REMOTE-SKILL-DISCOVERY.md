# 远程技能发现系统文档

## 目录

- [概述](#概述)
- [使用场景](#使用场景)
- [使用案例](#使用案例)
- [调用过程](#调用过程)
- [架构设计](#架构设计)
- [API 参考](#api-参考)
- [技能仓库规范](#技能仓库规范)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

---

## 概述

远程技能发现系统允许用户从远程技能仓库搜索、下载和安装技能，扩展 Nanobot 的功能。

### 核心特性

- ✅ **远程发现** - 从 HTTP 仓库获取技能索引
- ✅ **一键安装** - 自动下载所有技能文件
- ✅ **依赖验证** - 安装后验证技能完整性
- ✅ **状态管理** - 检查技能是否已安装
- ✅ **卸载支持** - 支持卸载不需要的技能

### 工作流程

```
用户搜索技能
    ↓
获取技能索引
    ↓
显示技能列表
    ↓
用户选择技能
    ↓
下载技能文件
    ↓
安装到本地
    ↓
验证安装
    ↓
刷新技能列表
```

---

## 使用场景

### 场景 1：发现领域相关技能

**场景描述**：用户需要某个特定领域的技能支持，例如 AI SDK 开发、TUI 开发、Web 自动化等。

**操作步骤**：

1. 执行 `/skill:find` 命令
2. 查看可用技能列表
3. 浏览技能描述，找到相关技能
4. 选择并安装技能

### 场景 2：社区贡献技能

**场景描述**：社区开发者创建了新技能，想要分享给其他用户。

**操作步骤**：

1. 创建技能仓库，遵循技能仓库规范
2. 部署到 HTTP 服务器或 GitHub Pages
3. 用户通过 `/skill:find` 命令搜索技能
4. 安装并使用技能

### 场景 3：团队技能管理

**场景描述**：团队内部维护一组自定义技能，需要统一分发和管理。

**操作步骤**：

1. 搭建内部技能仓库
2. 团队成员通过仓库安装技能
3. 定期更新技能版本
4. 统一管理技能依赖

---

## 使用案例

### 案例 1：安装 AI SDK 技能

**目标**：安装 AI SDK 技能，帮助开发 AI 应用。

**操作步骤**：

```bash
# 1. 打开技能搜索
/skill:find

# 2. 在对话框中查看所有技能
# 显示：
# - AI SDK - Answer questions about AI SDK...
# - OpenTUI - Comprehensive OpenTUI skill...
# - Agent Browser - Browser automation...

# 3. 使用 ↑↓ 导航到 AI SDK
# 4. 按 Enter 确认安装

# 5. 系统自动下载并安装
# 下载：https://skills.opencode.ai/ai-sdk/SKILL.md
# 下载：https://skills.opencode.ai/ai-sdk/examples/basic.md
# 下载：https://skills.opencode.ai/ai-sdk/examples/advanced.md
# 下载：https://skills.opencode.ai/ai-sdk/reference.md

# 6. 安装成功
# 技能 "ai-sdk" 安装成功！请运行 /skills 刷新列表。

# 7. 刷新技能列表
/skills

# 8. 查看已安装技能
# 显示：
# Skills
# Installed Skills (3/3)
#   > ai-sdk (1.0.0) - Active
#     Answer questions about AI SDK and help build AI-powered features.
#   > opentui - Active
#     Comprehensive OpenTUI skill for building terminal user interfaces.
#   > test-skill - Active
#     测试技能，用于验证技能加载和匹配功能。
```

**使用技能**：

```bash
# 方式 1：使用 Slash 命令
/skill ai-sdk

# Agent 响应
# 已选择 ai-sdk 技能，请继续提问...

# 提问
如何使用 generateText 生成文本？

# Agent 响应
# [自动调用 load_skill({ skillName: "ai-sdk" })]
# [返回完整技能内容]
# 解答：使用 generateText 的方法如下...
```

### 案例 2：Agent 自动匹配技能

**目标**：让 Agent 自动识别需要使用哪个技能。

**操作步骤**：

```bash
# 用户提问
我需要使用 TUI 开发一个终端应用，应该用什么？

# Agent 自动调用
match_skill({ query: "TUI 开发终端应用" })

# 系统响应
1. **opentui** (相关度: 80%)
   Comprehensive OpenTUI skill for building terminal user interfaces. Covers the core imperative API, React reconciler, and Solid reconciler.

2. **agent-browser** (相关度: 20%)
   Browser automation CLI for AI agents. Use when the user needs to interact with websites.

提示：使用 load_skill({ skillName: "xxx" }) 加载完整技能内容。

# Agent 继续调用
load_skill({ skillName: "opentui" })

# 返回完整技能内容
# [显示 OpenTUI 技能的完整内容]
```

### 案例 3：卸载不需要的技能

**目标**：卸载不再需要的技能。

**操作步骤**：

```bash
# 1. 查看已安装技能
/skills

# 2. 选择要卸载的技能
# [假设有一个 test-skill 需要卸载]

# 3. 使用程序化方式卸载
# [需要在代码中调用 SkillDiscoverer.uninstall()]
await discoverer.uninstall('test-skill');

# 4. 刷新技能列表
/skills

# 5. 确认技能已卸载
# Installed Skills (2/2)
#   > ai-sdk - Active
#   > opentui - Active
```

---

## 调用过程

### 完整调用流程

```
用户执行 /skill:find
         ↓
SlashCommandExecutor.execute()
         ↓
SkillFindHandler.execute()
         ↓
创建 SkillFindDialog
         ↓
Dialog 初始化（useEffect）
         ↓
调用 onSearch('')
         ↓
SkillDiscoverer.discover('https://skills.opencode.ai')
         ↓
HTTP GET https://skills.opencode.ai/index.json
         ↓
解析 JSON 响应
         ↓
过滤和验证技能列表
         ↓
显示技能列表到 Dialog
         ↓
用户选择技能并按 Enter
         ↓
调用 onInstall(skill, baseUrl)
         ↓
SkillDiscoverer.install(skill.name, baseUrl)
         ↓
检查技能是否已安装
         ↓
下载技能文件（遍历 files）
         ↓
写入文件到 workspace/skills/{skill-name}/
         ↓
验证 SKILL.md 是否存在
         ↓
记录日志并返回成功状态
         ↓
Dialog 关闭
         ↓
显示系统消息：安装成功
         ↓
用户执行 /skills 刷新列表
         ↓
显示更新后的技能列表
```

### 时序图

```
用户         CLI         Handler       Discoverer       Dialog         仓库
 |             |            |            |             |             |
 |-- /skill:find --->            |             |             |
 |             |----------->|            |             |             |
 |             |            |----------->|             |             |
 |             |            |            |----------->|             |
 |             |            |            |             |-- GET index->|
 |             |            |            |             |<-- JSON ----|
 |             |            |            |<--  skills --|             |
 |             |            |<-- createDialog|             |             |
 |             |<-- openDialog|             |             |             |
 |<--- 显示Dialog ---------------------------------------------|
 |                                                         |
 |-- 选择技能 --------------------------------------------->|
 |<------------------------------------------------------|
 |                                                         |
 |             |            |            |----------->|             |
 |             |            |            |             |-- GET files|
 |             |            |            |             |<-- files --|
 |             |            |            |<-- progress  |             |
 |<------------------------------------------------------|
 |                                                         |
 |             |            |<-- success   |             |             |
 |<--- 消息---------------------------------------------->|
 |             |            |                        |             |
 |-- /skills -->            |             |             |             |
 |<--- 显示列表---------------------------------------->
```

---

## 架构设计

### 模块结构

```
远程技能发现系统
├── SkillDiscoverer (src/core/skill-discovery.ts)
│   ├── discover(url) - 获取技能索引
│   ├── install(skillName, baseUrl) - 安装技能
│   ├── isInstalled(skillName) - 检查安装状态
│   ├── uninstall(skillName) - 卸载技能
│   └── clearCache() - 清理缓存
│
├── SlashCommandHandler (src/cli/tui/commands/handlers/)
│   └── SkillFindHandler - /skill:find 命令处理
│
└── Dialog Components (src/cli/tui/commands/dialogs/)
    └── SkillFindDialog - 技能搜索对话框
```

### 类设计

#### SkillDiscoverer

```typescript
class SkillDiscoverer {
  // 私有属性
  private readonly skillsDir: string; // workspace/skills
  private readonly cacheDir: string; // ~/.nanobot/cache/skills

  // 公共方法
  async discover(url: string): Promise<SkillIndexEntry[]>;
  async install(skillName: string, baseUrl: string): Promise<void>;
  async isInstalled(skillName: string): Promise<boolean>;
  async uninstall(skillName: string): Promise<void>;
  async clearCache(): Promise<void>;
}
```

#### 数据流

```
用户请求
    ↓
SlashCommandHandler
    ↓
Dialog Component
    ↓
SkillDiscoverer.discover()
    ↓
HTTP Request (fetch)
    ↓
JSON Response
    ↓
Filter & Validate
    ↓
Display in Dialog
    ↓
User Action (Enter)
    ↓
SkillDiscoverer.install()
    ↓
Download Files (fetch loop)
    ↓
Write to File System (fs)
    ↓
Validate Installation
    ↓
Success / Error
```

### 错误处理

```typescript
// 1. 网络错误
try {
  const response = await fetch(url);
} catch (error) {
  logger.error({ err: error, url }, 'Failed to fetch index');
  throw new Error(`网络错误：${error.message}`);
}

// 2. 格式错误
if (!data.skills || !Array.isArray(data.skills)) {
  throw new Error('Invalid index format: missing or invalid skills array');
}

// 3. 文件下载错误
try {
  await fetch(fileUrl);
} catch (error) {
  throw new Error(`Failed to download ${file}: ${response.status}`);
}

// 4. 已安装错误
if (await this.isInstalled(skillName)) {
  throw new Error(`Skill "${skillName}" is already installed`);
}

// 5. 验证失败
if (!exists) {
  throw new Error(`Installation validation failed: SKILL.md not found`);
}
```

---

## API 参考

### SkillDiscoverer

#### discover(url: string)

获取技能索引。

**参数：**

- `url` - 技能仓库的 URL

**返回：** `Promise<SkillIndexEntry[]>`

**示例：**

```typescript
const discoverer = new SkillDiscoverer(config);
const skills = await discoverer.discover('https://skills.opencode.ai');

console.log(skills);
// [
//   {
//     name: 'ai-sdk',
//     description: 'Answer questions about AI SDK...',
//     version: '1.0.0',
//     author: 'OpenCode Team',
//     files: ['SKILL.md', 'examples/basic.md']
//   },
//   ...
// ]
```

**错误：**

- 网络错误：`Failed to fetch index: <status> <statusText>`
- 格式错误：`Invalid index format: missing or invalid skills array`

---

#### install(skillName: string, baseUrl: string)

下载并安装指定技能。

**参数：**

- `skillName` - 要安装的技能名称
- `baseUrl` - 技能仓库的基础 URL

**返回：** `Promise<void>`

**示例：**

```typescript
const discoverer = new SkillDiscoverer(config);

try {
  await discoverer.install('ai-sdk', 'https://skills.opencode.ai/');
  console.log('安装成功');
} catch (error) {
  console.error('安装失败:', error.message);
}
```

**错误：**

- 已安装：`Skill "<skillName>" is already installed`
- 未找到：`Skill "<skillName>" not found in index`
- 下载失败：`Failed to download <file>: <status>`
- 验证失败：`Installation validation failed: SKILL.md not found`

**安装路径：**

```
workspace/skills/<skill-name>/
├── SKILL.md
├── examples/
│   ├── basic.md
│   └── advanced.md
└── reference.md
```

---

#### isInstalled(skillName: string)

检查技能是否已安装。

**参数：**

- `skillName` - 技能名称

**返回：** `Promise<boolean>`

**示例：**

```typescript
const discoverer = new SkillDiscoverer(config);

const installed = await discoverer.isInstalled('ai-sdk');
if (installed) {
  console.log('技能已安装');
} else {
  console.log('技能未安装');
}
```

---

#### uninstall(skillName: string)

卸载指定技能。

**参数：**

- `skillName` - 技能名称

**返回：** `Promise<void>`

**示例：**

```typescript
const discoverer = new SkillDiscoverer(config);

try {
  await discoverer.uninstall('ai-sdk');
  console.log('卸载成功');
} catch (error) {
  console.error('卸载失败:', error.message);
}
```

---

#### clearCache()

清理缓存目录。

**返回：** `Promise<void>`

**示例：**

```typescript
const discoverer = new SkillDiscoverer(config);

try {
  await discoverer.clearCache();
  console.log('缓存已清理');
} catch (error) {
  console.error('清理失败:', error.message);
}
```

**缓存路径：**

- `~/.nanobot/cache/skills/`

---

### SkillFindHandler

#### execute(context: SlashCommandContext)

处理 `/skill:find` 命令。

**参数：**

- `context` - Slash 命令上下文

**示例：**

```typescript
// 自动触发
/skill:find

// 手动触发（在代码中）
const handler = new SkillFindHandler();
await handler.execute({
  config: myConfig,
  openDialog: myOpenDialog,
  addSystemMessage: myAddSystemMessage,
});
```

---

### 数据类型

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

#### SkillIndex

```typescript
interface SkillIndex {
  skills: SkillIndexEntry[];
}
```

---

## 技能仓库规范

### 目录结构

```
https://skills.example.com/
├── index.json              # 必需：技能索引
└── <skill-name>/           # 技能目录
    ├── SKILL.md            # 必需：主技能文件
    ├── examples/            # 可选：示例文件
    │   ├── basic.md
    │   └── advanced.md
    └── reference.md         # 可选：参考文档
```

### index.json 格式

```json
{
  "skills": [
    {
      "name": "ai-sdk",
      "description": "Answer questions about AI SDK and help build AI-powered features.",
      "version": "1.0.0",
      "author": "OpenCode Team",
      "files": ["SKILL.md", "examples/basic.md", "examples/advanced.md", "reference.md"]
    },
    {
      "name": "opentui",
      "description": "Comprehensive OpenTUI skill for building terminal user interfaces.",
      "version": "1.2.0",
      "files": ["SKILL.md", "reference.md"]
    }
  ]
}
```

### 字段说明

| 字段          | 类型     | 必需 | 说明                         |
| ------------- | -------- | ---- | ---------------------------- |
| `name`        | string   | ✅   | 技能名称，必须与目录名一致   |
| `description` | string   | ✅   | 技能描述，用于显示和搜索     |
| `files`       | string[] | ✅   | 技能文件列表，相对路径       |
| `version`     | string   | ❌   | 版本号（推荐使用语义化版本） |
| `author`      | string   | ❌   | 作者名称或组织               |

### SKILL.md 格式

必须遵循 Nanobot 技能标准格式：

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
# AI SDK 技能内容

这里填写技能的详细内容...
```

---

## 最佳实践

### 1. 技能仓库设计

#### ✅ 推荐

**清晰的技能分类：**

```json
{
  "skills": [
    {
      "name": "ai-sdk",
      "category": "development",
      "tags": ["ai", "llm"]
    }
  ]
}
```

**详细的技能描述：**

```json
{
  "description": "Answer questions about AI SDK. Use when: (1) building AI apps, (2) using generateText/streamText, (3) implementing tool calling."
}
```

**合理的文件组织：**

```
ai-sdk/
├── SKILL.md              # 主要内容
├── examples/             # 示例
│   ├── basic.md
│   └── advanced.md
├── reference.md          # API 参考
└── CHANGELOG.md          # 更新日志
```

#### ❌ 避免

**模糊的描述：**

```json
{
  "description": "A skill for development."
}
```

**过多的文件：**

```json
{
  "files": [
    "SKILL.md",
    "chapter1.md",
    "chapter2.md",
    "chapter3.md",
    "chapter4.md"
    // ... 更多文件
  ]
}
```

---

### 2. 错误处理

#### ✅ 推荐

**详细的错误信息：**

```typescript
if (!response.ok) {
  throw new Error(
    `Failed to download ${file}: ` + `HTTP ${response.status} ${response.statusText}`,
  );
}
```

**重试机制：**

```typescript
async function downloadWithRetry(url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

**验证下载完整性：**

```typescript
const downloaded = await response.arrayBuffer();
if (downloaded.byteLength === 0) {
  throw new Error(`Downloaded file is empty: ${file}`);
}
```

---

### 3. 用户体验

#### ✅ 推荐

**实时进度反馈：**

```typescript
for (const file of skill.files) {
  logger.info(`Downloading: ${file}`);
  // 显示进度：3/5
}

logger.info(`Installing skill: ${skillName} (2/5)`);
```

**清晰的成功/失败消息：**

```typescript
addSystemMessage(`✓ 技能 "${skill.name}" 安装成功！`);
addSystemMessage(`✗ 安装失败：${error.message}`);
```

**提供后续操作指导：**

```typescript
addSystemMessage(`技能 "${skill.name}" 安装成功！\n\n` + `请运行 /skills 刷新列表。`);
```

---

### 4. 性能优化

#### ✅ 推荐

**并发下载：**

```typescript
await Promise.all(
  skill.files.map(async file => {
    await downloadFile(file);
  }),
);
```

**缓存索引：**

```typescript
private cache = new Map<string, SkillIndexEntry[]>();

async discover(url: string): Promise<SkillIndexEntry[]> {
  if (this.cache.has(url)) {
    return this.cache.get(url)!;
  }

  const skills = await fetchIndex(url);
  this.cache.set(url, skills);
  return skills;
}
```

**增量更新：**

```typescript
async install(skillName: string, baseUrl: string): Promise<void> {
  const existingFiles = await this.getInstalledFiles(skillName);

  // 只下载新增或修改的文件
  for (const file of skill.files) {
    if (!existingFiles.includes(file)) {
      await downloadFile(file);
    }
  }
}
```

---

## 故障排除

### 问题 1：无法连接到技能仓库

**症状：**

```
搜索失败：Failed to fetch index: Failed to connect
```

**可能原因：**

1. 网络连接问题
2. 技能仓库 URL 错误
3. 服务器宕机

**解决方法：**

```bash
# 1. 检查网络连接
ping skills.opencode.ai

# 2. 检查 URL 是否正确
# 确保使用 https:// 开头

# 3. 尝试手动访问
curl https://skills.opencode.ai/index.json
```

---

### 问题 2：技能安装失败

**症状：**

```
安装失败：Failed to download SKILL.md: 404
```

**可能原因：**

1. 技能文件不存在
2. 文件路径错误
3. 服务器权限问题

**解决方法：**

```bash
# 1. 检查技能仓库结构
ls -la skills.opencode.ai/ai-sdk/

# 2. 检查 index.json 中的 files 字段
cat index.json | jq '.skills[] | select(.name == "ai-sdk")'

# 3. 验证文件可访问
curl -I https://skills.opencode.ai/ai-sdk/SKILL.md
```

---

### 问题 3：技能安装成功但不可用

**症状：**

```
技能已安装但在 /skills 中不显示
```

**可能原因：**

1. SKILL.md 格式错误
2. 依赖未满足
3. 技能加载器缓存问题

**解决方法：**

```bash
# 1. 检查 SKILL.md 格式
cat workspace/skills/ai-sdk/SKILL.md | head -10

# 2. 检查依赖
# 查看 requires.bins 和 requires.env

# 3. 清理缓存
rm -rf ~/.nanobot/cache/skills/*

# 4. 重启 nanobot
nanobot /skills
```

---

### 问题 4：下载速度慢

**症状：**

```
下载技能需要很长时间
```

**可能原因：**

1. 网络带宽低
2. 技能文件过大
3. 服务器响应慢

**解决方法：**

```typescript
// 1. 使用并发下载
await Promise.all(skill.files.map(file => downloadFile(file)));

// 2. 添加进度显示
const progress = Math.round((downloaded / total) * 100);
logger.info(`Downloading... ${progress}%`);

// 3. 添加取消功能
const abortController = new AbortController();
fetch(url, { signal: abortController.signal });
```

---

### 问题 5：磁盘空间不足

**症状：**

```
ENOSPC: no space left on device
```

**可能原因：**

1. 磁盘空间不足
2. 临时文件过多

**解决方法：**

```bash
# 1. 检查磁盘空间
df -h

# 2. 清理缓存
nanobot /skill:clear-cache

# 3. 卸载不需要的技能
# 通过代码调用 discoverer.uninstall()

# 4. 清理工作区
rm -rf workspace/skills/*/examples/*
```

---

## 附录

### A. 环境变量配置

```bash
# 技能仓库 URL（可选）
export NANOBOT_SKILL_REPO="https://skills.opencode.ai"

# 缓存目录（可选）
export NANOBOT_CACHE_DIR="~/.nanobot/cache/skills"

# 超时设置（可选）
export NANOBOT_DOWNLOAD_TIMEOUT=30000  # 30秒
```

### B. 配置文件

```json
{
  "skills": {
    "repositories": ["https://skills.opencode.ai", "https://skills.example.com"],
    "autoUpdate": false,
    "cacheEnabled": true
  }
}
```

### C. 日志级别

```typescript
// DEBUG - 详细调试信息
logger.debug(`Downloading: ${fileUrl}`);

// INFO - 一般操作信息
logger.info(`Skill "${skillName}" installed successfully`);

// WARN - 警告信息
logger.warn({ skill }, 'Invalid skill entry, skipping');

// ERROR - 错误信息
logger.error({ err: error }, 'Failed to discover skills');
```

---

## 更新日志

### v1.0.0 (2026-03-04)

- ✅ 初始版本
- ✅ 实现远程技能发现
- ✅ 实现技能安装和卸载
- ✅ 实现 SkillFindDialog UI 组件
- ✅ 实现 SkillFindHandler 命令处理

---

## 相关资源

- [Nanobot 主文档](../README.md)
- [技能系统文档](./SKILL-SYSTEM.md)
- [Agent 配置](./AGENT-CONFIG.md)
- [OpenCode 技能仓库](https://skills.opencode.ai)

---

**文档版本**：1.0.0  
**最后更新**：2026-03-04
