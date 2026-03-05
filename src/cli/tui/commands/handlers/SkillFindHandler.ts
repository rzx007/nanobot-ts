import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { SkillDiscoverer } from '@/skills';
import { createSkillFindDialog } from '../dialogs';
import { SkillInfo } from '@/core';

export class SkillFindHandler implements SlashCommandHandler {
  id = 'skill:find';
  label = '/skill:find';
  description = '搜索并安装新技能';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { config, openDialog, addSystemMessage } = context;

    if (!config) {
      addSystemMessage('配置未加载');
      return;
    }

    const discoverer = new SkillDiscoverer(config);

    const { element } = createSkillFindDialog({
      onSearch: async (query: string) => {
        // 默认使用 OpenCode 技能仓库
        const defaultUrl = 'https://skills.opencode.ai';
        try {
          const results = await discoverer.discover(defaultUrl);
          return results.filter(
            s =>
              s.name.toLowerCase().includes(query.toLowerCase()) ||
              s.description.toLowerCase().includes(query.toLowerCase()),
          );
        } catch (error) {
          addSystemMessage(`搜索失败：${error instanceof Error ? error.message : String(error)}`);
          return [];
        }
      },
      onInstall: async (skill: SkillInfo, baseUrl: string) => {
        try {
          await discoverer.install(skill.name, baseUrl);
          addSystemMessage(`技能 "${skill.name}" 安装成功！请运行 /skills 刷新列表。`);
          return true;
        } catch (error) {
          addSystemMessage(`安装失败：${error instanceof Error ? error.message : String(error)}`);
          return false;
        }
      },
    });

    openDialog(element);
  }
}
