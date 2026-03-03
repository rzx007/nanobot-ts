import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createSkillsDialog } from '../dialogs';
import type { SkillInfo } from '../dialogs/types';

/**
 * 已安装的技能列表
 * TODO: 从 Skills CLI 或配置中读取
 */
const INSTALLED_SKILLS: SkillInfo[] = [
  {
    id: 'find-skills',
    name: 'Find Skills',
    description: '查找和安装技能',
    enabled: true,
    version: '1.0.0',
    author: 'Anthropic',
  },
  {
    id: 'commit',
    name: 'Commit',
    description: 'Git 提交助手',
    enabled: true,
    version: '1.0.0',
    author: 'Anthropic',
  },
  {
    id: 'review-pr',
    name: 'Review PR',
    description: 'PR 审查助手',
    enabled: false,
    version: '1.0.0',
    author: 'Anthropic',
  },
  {
    id: 'test',
    name: 'Test',
    description: '测试运行助手',
    enabled: true,
    version: '1.0.0',
    author: 'Anthropic',
  },
  {
    id: 'glm-plan-usage',
    name: 'GLM Plan Usage',
    description: '查询 GLM Coding Plan 使用统计',
    enabled: true,
    version: '1.0.0',
  },
];

/**
 * /skills 命令处理器
 * 使用 Dialog 查看和管理技能
 */
export class SkillsHandler implements SlashCommandHandler {
  id = 'skills';
  label = '/skills';
  description = 'Skills';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { openDialog, addSystemMessage } = context;

    // 创建并打开技能查看 Dialog
    const { element } = createSkillsDialog({
      skills: INSTALLED_SKILLS,
      onToggleSkill: (skillId: string, enabled: boolean) => {
        // TODO: 实时更新技能启用状态
        addSystemMessage(`技能 ${skillId} ${enabled ? '已启用' : '已禁用'}`);
      },
      onViewDetails: (skillId: string) => {
        // TODO: 显示技能详情
        addSystemMessage(`查看技能详情: ${skillId}`);
      },
    });

    openDialog(element);
  }
}
