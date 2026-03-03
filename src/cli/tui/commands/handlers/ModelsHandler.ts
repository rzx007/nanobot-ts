import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /models 命令处理器
 * 跳转到配置页面
 */
export class ModelsHandler implements SlashCommandHandler {
  id = 'models';
  label = '/models';
  description = 'Switch model';
  category = 'navigation' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { navigateTo } = context;
    navigateTo('config');
  }
}
