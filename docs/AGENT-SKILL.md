## 当前 Skill 调用机制分析

### 现状

**自动触发方式**：
- Skill 在 `description` 中定义触发关键词（如 ai-sdk 的 "Triggers on: 'AI SDK', 'generateText'..."）
- Agent 根据系统提示词中的 XML 摘要自行判断是否需要某个 skill
- Agent 使用 `read_file` 工具加载 SKILL.md 内容

**常驻技能**：
- `always: true` 的技能自动加载完整内容到系统提示词

**存在的问题**：
1. 无显式技能指定方式
2. Agent 判断可能不准确
3. 触发关键词纯文本，无结构化匹配
4. 用户无法主动控制技能加载

### 设计方案对比

#### **方案 1：添加 `load_skill` 工具** ⭐️ 推荐

**优点**：
- 用户显式指定，意图明确
- 与现有工具机制一致
- Agent 可以灵活调用
- 支持动态加载

**实现要点**：
```typescript
// src/tools/skill.ts
export class LoadSkillTool extends Tool {
  name = 'load_skill';
  description = '加载指定技能的完整内容到当前上下文';
  
  parameters = {
    type: 'object',
    properties: {
      skillName: {
        type: 'string',
        description: '技能名称（如 ai-sdk, opentui）'
      }
    },
    required: ['skillName']
  };

  async execute(params: { skillName: string }): Promise<string> {
    // 从 SkillLoader 获取技能内容
    // 返回技能完整内容
  }
}
```

**使用示例**：
```
用户: 帮我使用 AI SDK 构建一个聊天机器人
Agent: load_skill({ skillName: 'ai-sdk' })
→ 返回 ai-sdk 完整内容
→ Agent 使用该内容回答
```

---

#### **方案 2：消息命令前缀**

**优点**：
- 语法简洁
- 用户友好

**缺点**：
- 需要消息预处理逻辑
- 改动较大

**实现示例**：
```
/skill:ai-sdk 如何使用 generateText？
→ 自动加载 ai-sdk 技能
→ 传递给 Agent 处理
```

---

#### **方案 3：技能自动匹配增强**

**优点**：
- 无需用户干预
- 智能化体验

**缺点**：
- 复杂度高
- 仍然依赖 Agent 判断

**实现要点**：
- 解析 description 中的 "Triggers on"
- 构建关键词映射表
- 消息预处理时检测关键词

---

### 推荐方案（方案 1）详细设计

#### 1. 创建 LoadSkillTool

```typescript
// src/tools/skill.ts
export class LoadSkillTool extends Tool {
  name = 'load_skill';
  
  description = `加载指定技能的完整内容。
用法示例：
- load_skill({ skillName: 'ai-sdk' }) - 加载 AI SDK 技能
- load_skill({ skillName: 'opentui' }) - 加载 OpenTUI 技能

注意事项：
- 技能名称必须与 workspace/skills/{skill-name}/ 目录名一致
- 加载的技能内容会注入到当前对话上下文中
- 如果技能不存在或依赖未满足，会返回错误信息`;

  parameters = {
    type: 'object',
    properties: {
      skillName: {
        type: 'string',
        description: '要加载的技能名称'
      }
    },
    required: ['skillName']
  };

  riskLevel = RiskLevel.LOW;
  
  private skillLoader: SkillLoader | null = null;

  setSkillLoader(loader: SkillLoader): void {
    this.skillLoader = loader;
  }

  async execute(params: { skillName: string }): Promise<string> {
    const { skillName } = params;
    
    if (!this.skillLoader) {
      return '错误：技能加载器未初始化';
    }

    const skill = this.skillLoader.getSkill(skillName);
    
    if (!skill) {
      const available = this.skillLoader.getSkillNames();
      return `错误：找不到技能 "${skillName}"\n可用的技能：${available.join(', ')}`;
    }

    if (skill.available === false) {
      return `错误：技能 "${skillName}" 依赖未满足`;
    }

    // 返回技能完整内容
    return `## Skill: ${skill.name}\n\n${skill.content}`;
  }
}
```

#### 2. 注册工具

```typescript
// src/cli/setup.ts
import { LoadSkillTool } from '@/tools/skill';

export async function buildAgentRuntime(config: Config): Promise<AgentRuntime> {
  // ... 其他初始化
  
  const skills = new SkillLoader(config);
  await skills.init();
  
  const loadSkillTool = new LoadSkillTool();
  loadSkillTool.setSkillLoader(skills);
  tools.register(loadSkillTool);
  
  // ...
}
```

#### 3. 系统提示词更新

```typescript
// src/core/context.ts - getIdentity()
```

## Tool Call Guidelines
- Before calling tools, you may briefly state your intent...
- **Load skills**: Use `load_skill` tool to load skill content when needed
- Available skills: see # Skills section below
```

#### 4. Skill 文件增强（可选）

在 SKILL.md frontmatter 中添加提示：

```yaml
---
name: ai-sdk
description: ...
triggers: ['AI SDK', 'generateText', 'streamText', 'build agent']
---

# AI SDK 技能

**提示**：你也可以使用 `load_skill({ skillName: 'ai-sdk' })` 工具显式加载此技能。
```

### 使用流程

**场景 1：Agent 主动加载**
```
用户: 帮我用 generateText 实现一个流式生成
Agent: 我需要使用 AI SDK 技能来帮助你。
      load_skill({ skillName: 'ai-sdk' })
      [读取 ai-sdk 内容]
      根据文档，generateText 用于...
```

**场景 2：用户显式指定**
```
用户: 加载 opentui 技能帮我创建一个 TUI
Agent: load_skill({ skillName: 'opentui' })
      [读取 opentui 内容]
      好的，已加载 OpenTUI 技能。根据文档...
```

### 优势总结

✅ **意图明确**：用户可以显式指定技能  
✅ **灵活调用**：Agent 可以根据需要动态加载  
✅ **最小改动**：只需添加一个工具，不影响现有机制  
✅ **向后兼容**：现有的 `always: true` 机制继续工作  
✅ **易于调试**：用户可以看到技能加载过程  
✅ **可扩展性**：未来可以扩展支持技能版本、技能参数等

你觉得这个方案如何？需要我调整或者深入探讨某个部分吗？