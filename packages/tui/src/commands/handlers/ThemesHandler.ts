import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /themes 命令处理器
 * 跳转到配置页面
 */
export class ThemesHandler implements SlashCommandHandler {
  id = 'themes';
  label = '/themes';
  description = 'Switch theme';
  category = 'navigation' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { navigateTo } = context;
    navigateTo('config');
  }
}
