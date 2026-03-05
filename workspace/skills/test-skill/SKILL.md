---
name: test-skill
description: 测试技能，用于验证技能加载和匹配功能。
version: 1.0.0
author: Nanobot Team

triggers:
  - test
  - demo
  - example

always: false

requires:
  bins:
    - node
  env: []

metadata:
  category: testing
  tags:
    - test
    - demo
---

# Test Skill

这是测试技能，用于验证技能加载和匹配功能。

## 功能

- 测试技能加载
- 测试技能匹配
- 测试技能工具

## 使用方法

用户可以在任何上下文中提到"test"或"demo"等关键词，系统会建议使用此技能。

## 示例

1. 测试技能加载：
   - 运行 `/skills` 命令查看已安装技能
   - 查找 test-skill 技能

2. 测试技能匹配：
   - 输入"请帮我测试一个功能"
   - Agent 会使用 `match_skill` 工具匹配到这个技能

3. 测试技能加载：
   - Agent 可以使用 `load_skill({ skillName: "test-skill" })` 加载此技能的完整内容
