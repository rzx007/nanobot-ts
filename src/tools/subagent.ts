/**
 * Subagent 工具
 *
 * 用于启动子代理任务，替代旧的 spawn 工具
 */

import { Tool } from './base';
import type { SubagentManager } from '@/core/subagent';
import { RiskLevel } from './safety';
import { logger } from '@/utils/logger';

export class SubagentTool extends Tool {
  name = 'subagent';

  description =
    'Spawn a subagent to handle a task in the background. Use this for complex or time-consuming tasks that can run independently. The subagent will complete the task and report back when done.';

  riskLevel = RiskLevel.HIGH;

  private manager: SubagentManager | null = null;
  private originChannel = 'cli';
  private originChatId = 'direct';
  private sessionKey = 'cli:direct';

  constructor() {
    super();
  }

  setManager(manager: SubagentManager): void {
    this.manager = manager;
  }

  parameters = {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'The task for the subagent to complete',
      },
      label: {
        type: 'string',
        description: 'Optional short label for the task (for display)',
      },
    },
    required: ['task'],
  };

  setContext(channel: string, chatId: string): void {
    this.originChannel = channel;
    this.originChatId = chatId;
    this.sessionKey = `${channel}:${chatId}`;
  }

  async execute(params: { task: string; label?: string }): Promise<string> {
    if (!this.manager) {
      return 'Error: Subagent manager not initialized';
    }

    const { task, label } = params;
    try {
      logger.info({ task, label }, 'Spawning subagent');

      const spawnOptions: {
        label?: string;
        originChannel?: string;
        originChatId?: string;
        sessionKey?: string;
      } = {
        originChannel: this.originChannel,
        originChatId: this.originChatId,
        sessionKey: this.sessionKey,
      };

      if (label !== undefined) {
        spawnOptions.label = label;
      }

      const result = await this.manager.spawn(task, spawnOptions);

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ err: error, task }, 'Subagent spawn failed');
      return `Error: Subagent spawn failed: ${msg}`;
    }
  }
}
