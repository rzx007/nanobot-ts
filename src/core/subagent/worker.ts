/**
 * Subagent Worker
 *
 * 负责执行子代理任务，使用过滤后的工具集
 */

import type { SubagentTask, SubagentResult, SubagentWorkerConfig } from './types';
import type { ToolSet } from '@/bus/types';
import { LLMProvider } from '@/providers';
import type { ToolRegistry } from '@/tools';
import { logger } from '@/utils/logger';

export class SubagentWorker {
  private provider: LLMProvider;
  private tools: ToolRegistry;
  private workspace: string;
  private maxIterations: number;
  private config: import('../../config/schema').Config;

  constructor(workerConfig: SubagentWorkerConfig) {
    this.provider = workerConfig.provider;
    this.tools = workerConfig.tools;
    this.workspace = workerConfig.workspace;
    this.maxIterations = workerConfig.maxIterations;
    this.config = workerConfig.config;
  }

  /**
   * 执行子代理任务
   * 该方法负责执行具体的子代理任务，包括构建系统提示词、运行LLM循环、执行工具等
   * @param jobData - 任务数据对象，包含任务ID和任务描述
   * @returns Promise<SubagentResult> - 返回任务执行结果的Promise
   */
  async execute(jobData: SubagentTask): Promise<SubagentResult> {
    const { taskId, task } = jobData;

    logger.info({ taskId, task }, 'Subagent worker executing task');

    try {
      const result = await this.runAgentLoop(task);
      return {
        taskId,
        result,
        status: 'completed',
        completedAt: new Date(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ taskId, error: errorMsg }, 'Subagent task failed');
      return {
        taskId,
        result: '',
        status: 'failed',
        error: errorMsg,
        completedAt: new Date(),
      };
    }
  }

  private async runAgentLoop(task: string): Promise<string> {
    const toolDefinitions = this.buildFilteredToolSet();

    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: this.buildSystemPrompt(),
      },
      {
        role: 'user',
        content: task,
      },
    ];

    try {
      const response = await this.provider.chat({
        messages,
        tools: toolDefinitions,
        model: this.config.agents.defaults.model,
        temperature: this.config.agents.defaults.temperature,
        maxTokens: this.config.agents.defaults.maxTokens,
        maxSteps: this.maxIterations,
        executeTool: async (name, args) => {
          const result = await this.tools.execute(name, args, {
            channel: 'subagent',
            chatId: 'internal',
          });
          return `Tool "${name}" returned:\n${result}`;
        },
      });

      const finalResult = response.content ?? '';

      console.log('🚀 ~ SubagentWorker ~ runAgentLoop ~ finalResult:', finalResult);

      return finalResult;
    } catch (error) {
      const errorMsg = `LLM call failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error({ error: errorMsg }, 'LLM error in subagent');
      throw error;
    }
  }

  private buildFilteredToolSet(): ToolSet {
    const result: ToolSet = {};
    const toolNames = this.tools.getToolNames();

    for (const name of toolNames) {
      if (name === 'spawn' || name === 'message') {
        logger.debug(`Excluding tool from subagent: ${name}`);
        continue;
      }

      const tool = this.tools.get(name);
      if (tool) {
        result[name] = tool.toSchema();
      }
    }

    return result;
  }

  private buildSystemPrompt(): string {
    const timeCtx = new Date().toISOString();

    // 检测当前平台
    const platform = process.platform;
    const isWindows = platform === 'win32';
    const isMacOS = platform === 'darwin';
    const isLinux = platform === 'linux';

    // 构建平台特定的命令提示
    let commandHint = '';
    if (isWindows) {
      commandHint = `## Command Execution (Windows)
Important: Use the correct command format for Windows:
- cd /d "path" && command  (Use '&&' with cd /d)
- OR use full paths: "path\\command"
- DO NOT use: cd path && command (Does not work in Windows)
- For PowerShell, use: Set-Location "path"; command`;
    } else if (isMacOS || isLinux) {
      commandHint = `## Command Execution (${platform === 'darwin' ? 'macOS' : 'Linux'})
Standard shell commands with && or ; separators work normally:
- cd /path/to/directory && command
- cd /path/to/directory; command`;
    }

    const parts = [
      `# Subagent

${timeCtx}

You are a subagent spawned by the main agent to complete a specific task.
Stay focused on the assigned task. Your final response will be reported back to the main agent.

## Current Platform
${platform} (${isWindows ? 'Windows' : isMacOS ? 'macOS' : 'Linux'})

${commandHint}

## Workspace
${this.workspace}

## Tools
You have access to the following tools (excluding spawn and message to prevent infinite recursion):
${this.tools
  .getToolNames()
  .filter((n: string) => n !== 'spawn' && n !== 'message')
  .join(', ')}

## Instructions
1. Stay focused on the assigned task
2. Use tools as needed
3. Provide a clear, concise final result
4. Maximum ${this.maxIterations} iterations
5. Do not spawn additional subagents or send messages`,
    ];

    return parts.join('\n\n');
  }
}
