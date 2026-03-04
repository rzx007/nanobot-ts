import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createSkillsDialog } from '../dialogs';
import type { SkillInfo } from '../dialogs/types';

/**
 * /skills 命令处理器
 * 显示已安装的技能列表，支持启用/禁用、查看详情、使用技能
 */
export class SkillsHandler implements SlashCommandHandler {
  id = 'skills';
  label = '/skills';
  description = '查看和管理已安装的技能';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { runtime, openDialog, addSystemMessage } = context;

    if (!runtime?.skills) {
      addSystemMessage('技能加载器未初始化');
      return;
    }

    const skills = runtime.skills.getAllSkills();
    const skillList: SkillInfo[] = skills.map(s => ({
      id: s.name,
      name: s.name,
      description: s.description ?? s.name,
      enabled: s.available !== false,
      version: (s._frontmatter as any)?.version,
      author: (s._frontmatter as any)?.author,
    }));

    const { element } = createSkillsDialog({
      skills: skillList,
      onToggleSkill: (skillId: string, enabled: boolean) => {
        // TODO: 实现技能启用/禁用功能（需要修改 SkillLoader 支持启用/禁用状态）
        addSystemMessage(`技能 ${skillId} ${enabled ? '已启用' : '已禁用'}`);
      },
      onViewDetails: (skillId: string) => {
        // TODO: 显示技能详情对话框
        const skill = runtime?.skills?.getSkill(skillId);
        if (skill) {
          const metadata = skill._frontmatter ?? {};
          addSystemMessage(
            `技能详情:\n名称: ${skill.name}\n版本: ${(metadata as any).version ?? '未知'}\n作者: ${(metadata as any).author ?? '未知'}\n描述: ${skill.description}`,
          );
        } else {
          addSystemMessage(`找不到技能: ${skillId}`);
        }
      },
      onRefresh: async () => {
        // 刷新技能列表
        await runtime.skills.init();
        addSystemMessage('技能列表已刷新');
      },
    });

    openDialog(element);
  }
}
