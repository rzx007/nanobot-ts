/**
 * Spawn 工具：后台启动子进程，使用 execa 执行
 * PRD F3：后台子代理 / 启动子进程并返回结果或句柄
 */

import { execaCommand } from 'execa';
import { Tool } from './base';
import { logger } from '../utils/logger';

export interface SpawnToolContext {
  setContext(channel: string, chatId: string): void;
}

/**
 * Spawn 工具
 * 在后台启动子进程（如 shell 命令或 nanobot chat），返回进程句柄（pid）
 */
export class SpawnTool extends Tool {
  name = 'spawn';

  description =
    'Spawn a background process to run a task independently. Use for time-consuming or independent tasks. Returns process id (pid).';

  private originChannel = 'cli';
  private originChatId = 'direct';

  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to run in background (e.g. "node dist/cli/run.js chat \'reminder\'" or "sleep 30 && echo done")',
      },
      label: {
        type: 'string',
        description: 'Optional short label for the task (for display)',
      },
    },
    required: ['command'],
  };

  setContext(channel: string, chatId: string): void {
    this.originChannel = channel;
    this.originChatId = chatId;
  }

  getOriginContext(): { channel: string; chatId: string } {
    return { channel: this.originChannel, chatId: this.originChatId };
  }

  async execute(params: { command: string; label?: string }): Promise<string> {
    const { command, label } = params;
    try {
      logger.info({ command, label }, 'Spawning background process');

      const subprocess = execaCommand(command, {
        shell: true,
        detached: true,
        stdio: 'ignore',
      });

      subprocess.unref();

      const pid = subprocess.pid;
      if (pid == null) {
        return 'Error: Failed to get process id (process may have exited immediately)';
      }

      return `Spawned in background (pid: ${pid})${label ? ` [${label}]` : ''}. Process will run independently.`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, command }, 'Spawn failed');
      return `Error: Spawn failed: ${msg}`;
    }
  }
}
