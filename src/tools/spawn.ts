/**
 * Spawn 工具：后台启动子进程，使用 execa 执行
 *
 * ⚠️ @deprecated 请使用 SubagentTool 替代，功能更强大且支持任务跟踪
 */

import { execaCommand } from 'execa';
import { Tool } from './base';
import { RiskLevel } from './safety';
import { logger } from '../utils/logger';

export interface SpawnToolContext {
  setContext(channel: string, chatId: string): void;
}

/**
 * Spawn 工具
 * 在后台启动子进程（如 shell 命令或 nanobot chat），返回进程句柄（pid）
 *
 * ⚠️ @deprecated 此工具已废弃，请使用 subagent 工具替代
 */
export class SpawnTool extends Tool {
  name = 'spawn';

  description =
    '⚠️ [DEPRECATED] 请使用 subagent 工具替代。生成一个后台进程来独立运行任务。适用于耗时任务或独立任务场景。返回进程标识符（PID）。';

  riskLevel = RiskLevel.HIGH;

  private originChannel = 'cli';
  private originChatId = 'direct';

  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description:
          'Shell command to run in background (e.g. "node dist/cli/run.js chat \'reminder\'" or "sleep 30 && echo done")',
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
