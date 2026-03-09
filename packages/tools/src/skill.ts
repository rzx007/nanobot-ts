/**
 * 技能工具
 *
 * 提供 Agent 用于加载和匹配技能的工具
 */

import { Tool } from './base';
import { RiskLevel } from './safety';
import type { SkillInfo, SkillLoader } from '@nanobot/skills';
import { execSync } from 'child_process';

/**
 * 加载技能工具
 *
 * 允许 Agent 显式加载指定技能的完整内容到当前上下文
 */
export class LoadSkillTool extends Tool {
  name = 'load_skill';

  description = `加载指定技能的完整内容到当前上下文。

使用场景：
- 用户明确要求使用某个技能时
- Agent 判断需要特定技能的专业知识时

注意：
- 技能名称必须与 workspace/skills/{skill-name} 目录名一致
- 如果技能依赖未满足，会返回错误信息
- 返回技能的完整 Markdown 内容`;

  parameters = {
    type: 'object',
    properties: {
      skillName: {
        type: 'string',
        description: '要加载的技能名称（如 ai-sdk, opentui）',
      },
    },
    required: ['skillName'],
  };

  riskLevel = RiskLevel.LOW;

  private skillLoader: SkillLoader | null = null;

  /**
   * 设置技能加载器
   */
  setSkillLoader(loader: SkillLoader): void {
    this.skillLoader = loader;
  }

  async execute(params: { skillName: string }): Promise<string> {
    if (!this.skillLoader) {
      return '错误：技能加载器未初始化';
    }

    const skill = this.skillLoader.getSkill(params.skillName);

    if (!skill) {
      const available = this.skillLoader.getSkillNames();
      const availableList = available.length > 0 ? available.join(', ') : '无';
      return `错误：找不到技能 "${params.skillName}"\n可用技能：${availableList}`;
    }

    if (skill.available === false) {
      const missing = this._getMissingRequirements(skill);
      return `错误：技能 "${params.skillName}" 依赖未满足\n缺失：${missing}\n请安装缺失的依赖后再试。`;
    }

    // 返回技能完整内容
    return `## Skill: ${skill.name}${skill.version ? ` (v${skill.version})` : ''}\n\n${skill.content}`;
  }

  private _getMissingRequirements(skill: SkillInfo): string {
    const frontmatter = skill._frontmatter ?? {};
    const requires = (frontmatter.requires as any) ?? {};
    const missing: string[] = [];
    for (const bin of requires.bins ?? []) {
      if (!this._which(bin)) missing.push(`CLI: ${bin}`);
    }
    for (const env of requires.env ?? []) {
      if (!process.env[env]) missing.push(`ENV: ${env}`);
    }
    return missing.join(', ');
  }

  private _which(cmd: string): boolean {
    try {
      const cmdStr = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
      execSync(cmdStr, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * 匹配技能工具
 *
 * 允许 Agent 根据查询内容自动匹配最相关的技能
 */
export class MatchSkillTool extends Tool {
  name = 'match_skill';

  description = `根据查询内容匹配最相关的技能。

使用场景：
- 用户问题涉及特定领域但不确定使用哪个技能时
- 需要快速找到与当前任务相关的技能时

返回：
- 按相关度排序的技能列表
- 前 3 个匹配（可通过 limit 参数调整）
- 提示如何使用 load_skill 工具加载完整技能`;

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '查询内容（用户的问题或任务描述）',
      },
      limit: {
        type: 'number',
        description: '返回数量限制（默认 3）',
      },
    },
    required: ['query'],
  };

  riskLevel = RiskLevel.LOW;

  private skillLoader: SkillLoader | null = null;

  /**
   * 设置技能加载器
   */
  setSkillLoader(loader: SkillLoader): void {
    this.skillLoader = loader;
  }

  async execute(params: { query: string; limit?: number }): Promise<string> {
    if (!this.skillLoader) {
      return '错误：技能加载器未初始化';
    }

    const skills = this.skillLoader.getAllSkills();
    const limit = params.limit ?? 3;

    const matches = this._scoreSkills(skills, params.query, limit);

    if (matches.length === 0) {
      return '未找到匹配的技能';
    }

    const result = matches
      .map(
        (m, i) =>
          `${i + 1}. **${m.skill.name}**${m.skill.version ? ` (v${m.skill.version})` : ''} (相关度: ${(m.score * 100).toFixed(0)}%)\n   ${m.skill.description}`,
      )
      .join('\n\n');

    return result + `\n\n提示：使用 load_skill({ skillName: "xxx" }) 加载完整技能内容。`;
  }

  private _scoreSkills(
    skills: SkillInfo[],
    query: string,
    limit: number,
  ): Array<{ skill: SkillInfo; score: number }> {
    const queryLower = query.toLowerCase();
    const scores = skills.map(skill => {
      let score = 0;
      const desc = (skill.description ?? '').toLowerCase();

      // 从 frontmatter 提取触发关键词
      const frontmatter = skill._frontmatter ?? {};
      const triggers = Array.isArray(frontmatter.triggers) ? frontmatter.triggers : [];

      // 1. 匹配触发关键词（高权重 0.8）
      for (const trigger of triggers) {
        if (queryLower.includes(trigger.toLowerCase())) {
          score += 0.8;
        }
      }

      // 2. 匹配技能名称（中权重 0.5）
      if (queryLower.includes(skill.name.toLowerCase())) {
        score += 0.5;
      }

      // 3. 匹配描述（低权重 0.3）
      if (desc.includes(queryLower)) {
        score += 0.3;
      }

      return { skill, score: Math.min(score, 1) };
    });

    return scores
      .sort((a, b) => b.score - a.score)
      .filter(s => s.score > 0)
      .slice(0, limit);
  }
}
