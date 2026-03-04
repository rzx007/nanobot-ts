import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createSkillSelectDialog } from '../dialogs';

export class SkillSelectHandler implements SlashCommandHandler {
  id = 'skill';
  label = '/skill <name>';
  description = '使用指定技能（不指定名称则打开选择器）';
  category = 'chat' as const;

  async execute(context: SlashCommandContext, args?: string[]): Promise<void> {
    const skillName = args?.[0];
    const { runtime, addUserMessage, addSystemMessage, openDialog } = context;

    if (!skillName) {
      // 打开技能选择对话框
      const skills = runtime?.skills?.getAllSkills() ?? [];
      const skillList = skills.map(s => ({
        id: s.name,
        name: s.name,
        description: s.description ?? s.name,
      }));

      const { element } = createSkillSelectDialog({
        skills: skillList,
        onSelect: selectedSkill => {
          addUserMessage(`使用 ${selectedSkill} 技能：`);
        },
      });

      openDialog(element);
      return;
    }

    // 验证技能是否存在
    const skill = runtime?.skills?.getSkill(skillName);
    if (!skill) {
      const available = runtime?.skills?.getSkillNames().join(', ') ?? '';
      addSystemMessage(`技能 "${skillName}" 不存在\n可用技能：${available}`);
      return;
    }

    // 提示用户可以开始提问
    addSystemMessage(`已选择 ${skillName} 技能，请继续提问...`);
  }
}
