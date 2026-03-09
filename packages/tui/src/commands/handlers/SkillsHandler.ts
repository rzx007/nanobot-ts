import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createSkillsDialog } from '../dialogs';
import type { SkillInfo } from '../dialogs/types';

/**
 * /skills 命令处理器
 * 显示已安装的技能列表，支持选择技能并插入到输入框
 */
export class SkillsHandler implements SlashCommandHandler {
  id = 'skills';
  label = '/skills';
  description = '查看和管理已安装的技能';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { runtime, openDialog, addSystemMessage, chatInputRef } = context;

    if (!runtime?.skills) {
      addSystemMessage('技能加载器未初始化');
      return;
    }

    const skills = runtime.skills.getAllSkills();

    const skillList: SkillInfo[] = skills.map(s => ({
      id: s.name,
      name: s.name,
      description: s.description ?? s.name,
      version: (s._frontmatter as any)?.version,
      author: (s._frontmatter as any)?.author,
    }));

    const { element, onClose } = createSkillsDialog({
      skills: skillList,
      onSelectSkill: (skillId: string) => {
        const skill = runtime.skills.getSkill(skillId);
        if (skill) {
          try {
            if (chatInputRef?.current) {
              chatInputRef.current.insertText(`/${skill.name} `);
            }
            addSystemMessage(`已选择技能: ${skill.name}`);
            onClose?.();
          } catch (error) {
            console.error('Error selecting skill:', error);
            addSystemMessage(
              `选择技能失败: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      },
      onRefresh: async () => {
        await runtime.skills.init();
        addSystemMessage('技能列表已刷新');
      },
    });

    openDialog(element, onClose);
  }
}
