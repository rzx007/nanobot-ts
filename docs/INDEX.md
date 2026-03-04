# 文档索引

本目录包含 Nanobot 项目的完整文档。

## 文档列表

### 核心文档

- **[SKILL-SYSTEM.md](./SKILL-SYSTEM.md)** - 技能系统完整文档
  - 概述和核心概念
  - 技能格式规范（YAML Frontmatter）
  - 核心组件（SkillLoader, SkillDiscoverer, Skill Tools）
  - Slash 命令（/skill, /skills, /skill:find）
  - UI 组件（SkillsDialog, SkillSelectDialog, SkillFindDialog）
  - 使用场景和案例
  - Agent 工具（load_skill, match_skill）
  - 调用过程和架构设计
  - API 参考
  - 最佳实践和故障排除

- **[REMOTE-SKILL-DISCOVERY.md](./REMOTE-SKILL-DISCOVERY.md)** - 远程技能发现文档
  - 远程技能发现系统概述
  - 使用场景和案例
  - 调用过程和时序图
  - 架构设计
  - API 参考（SkillDiscoverer）
  - 技能仓库规范（index.json）
  - 最佳实践和故障排除

### 技术文档

- **[AGENT-SKILL.md](./AGENT-SKILL.md)** - Agent 技能使用指南
  - Agent 如何使用技能
  - 技能加载机制
  - 技能摘要格式
  - 工具调用示例

## 快速导航

### 按主题

#### 技能开发

- [技能格式](./SKILL-SYSTEM.md#技能格式)
- [技能编写最佳实践](./SKILL-SYSTEM.md#最佳实践)
- [技能仓库规范](./REMOTE-SKILL-DISCOVERY.md#技能仓库规范)

#### 用户使用

- [使用场景](./SKILL-SYSTEM.md#使用场景)
- [使用案例](./SKILL-SYSTEM.md#使用案例)
- [Slash 命令](./SKILL-SYSTEM.md#slash-命令)

#### 开发者集成

- [核心组件](./SKILL-SYSTEM.md#核心组件)
- [API 参考](./SKILL-SYSTEM.md#api-参考)
- [架构设计](./SKILL-SYSTEM.md#架构设计)

#### 故障排除

- [常见问题](./SKILL-SYSTEM.md#故障排除)
- [远程技能问题](./REMOTE-SKILL-DISCOVERY.md#故障排除)

### 按角色

#### 技能开发者

1. 阅读 [技能格式](./SKILL-SYSTEM.md#技能格式)
2. 参考 [最佳实践](./SKILL-SYSTEM.md#最佳实践)
3. 查看 [使用案例](./SKILL-SYSTEM.md#使用案例)

#### 技能仓库维护者

1. 阅读 [技能仓库规范](./REMOTE-SKILL-DISCOVERY.md#技能仓库规范)
2. 参考 [最佳实践](./REMOTE-SKILL-DISCOVERY.md#最佳实践)
3. 查看 [架构设计](./REMOTE-SKILL-DISCOVERY.md#架构设计)

#### Nanobot 用户

1. 阅读 [使用场景](./SKILL-SYSTEM.md#使用场景)
2. 学习 [Slash 命令](./SKILL-SYSTEM.md#slash-命令)
3. 查看 [使用案例](./SKILL-SYSTEM.md#使用案例)

## 文档统计

| 文档                      | 行数 | 字数    |
| ------------------------- | ---- | ------- |
| SKILL-SYSTEM.md           | 1770 | ~25,000 |
| REMOTE-SKILL-DISCOVERY.md | 1100 | ~15,000 |
| AGENT-SKILL.md            | ~400 | ~5,000  |

## 贡献

如果您发现文档有误或有改进建议，欢迎：

1. 提交 Issue 到 GitHub 仓库
2. 创建 Pull Request 修改文档
3. 在 Discord 社区讨论

## 相关链接

- [Nanobot GitHub](https://github.com/nanobot/nanobot-ts)
- [OpenCode 技能仓库](https://skills.opencode.ai)
- [OpenCode 技能标准](https://github.com/anomalyco/opencode/tree/dev/.agents/skills)

---

**最后更新**：2026-03-04
