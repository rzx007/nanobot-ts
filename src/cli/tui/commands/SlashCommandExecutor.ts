import type { SlashCommandHandler, SlashCommandContext } from './types';

/**
 * Slash 命令执行器
 * 负责管理和执行所有 Slash 命令
 */
export class SlashCommandExecutor {
  /** 命令处理器映射表 */
  private handlers = new Map<string, SlashCommandHandler>();

  /**
   * 注册命令处理器
   * @param handler 命令处理器实例
   */
  register(handler: SlashCommandHandler): void {
    this.handlers.set(handler.id, handler);
  }

  /**
   * 批量注册命令处理器
   * @param handlers 命令处理器数组
   */
  registerAll(handlers: SlashCommandHandler[]): void {
    handlers.forEach(handler => this.register(handler));
  }

  /**
   * 执行命令
   * @param commandId 命令 ID
   * @param context 命令执行上下文
   * @returns 是否成功执行（如果命令不存在返回 false）
   */
  async execute(commandId: string, context: SlashCommandContext): Promise<boolean> {
    const handler = this.handlers.get(commandId);
    if (!handler) {
      console.warn(`Slash command not found: ${commandId}`);
      return false;
    }

    try {
      await handler.execute(context);
      return true;
    } catch (error) {
      console.error(`Error executing slash command "${commandId}":`, error);
      context.addSystemMessage(`执行命令失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 检查命令是否已注册
   * @param commandId 命令 ID
   */
  has(commandId: string): boolean {
    return this.handlers.has(commandId);
  }

  /**
   * 获取所有已注册的命令 ID
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 获取所有命令的元数据，用于生成 SlashCommandOption 数组
   * @returns 命令选项数组
   */
  getSlashCommandOptions(): Array<{
    id: string;
    label: string;
    description: string;
  }> {
    return Array.from(this.handlers.values()).map(h => ({
      id: h.id,
      label: h.label,
      description: h.description,
    }));
  }
}
