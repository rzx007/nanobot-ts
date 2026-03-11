import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createStatusDialog } from '../dialogs';

/**
 * /status 命令处理器
 * 使用 Dialog 展示系统状态
 */
export class StatusHandler implements SlashCommandHandler {
  id = 'status';
  label = '/status';
  description = 'View status';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { runtime, config, openDialog } = context;

    // 创建并打开状态 Dialog
    const { element } = createStatusDialog({ runtime, config });
    openDialog(element);
  }
}
