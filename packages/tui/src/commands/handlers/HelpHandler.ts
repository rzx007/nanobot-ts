import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createHelpDialog } from '../dialogs';

/**
 * /help 命令处理器
 * 使用 Dialog 展示帮助信息
 */
export class HelpHandler implements SlashCommandHandler {
  id = 'help';
  label = '/help';
  description = 'Help';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { openDialog } = context;

    // 创建并打开帮助 Dialog
    const { element } = createHelpDialog();
    openDialog(element);
  }
}
