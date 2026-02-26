/**
 * Shell 执行工具
 * 
 * 执行 Shell 命令的工具实现
 */

import { execaCommand } from 'execa';
import { Tool } from './base';
import type { Config } from '../config/schema';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/helpers';

/**
 * Shell 执行工具
 */
export class ExecTool extends Tool {
  name = 'exec';

  description = '执行 Shell 命令';

  /** 配置 */
  private config: Config;

  /**
   * 构造函数
   * 
   * @param config - 配置对象
   */
  constructor(config: Config) {
    super();
    this.config = config;
  }

  parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 Shell 命令',
      },
    },
    required: ['command'],
  };

  /**
   * 执行 Shell 命令
   * 
   * @param params - 工具参数
   * @returns 执行结果
   */
  async execute(params: { command: string }): Promise<string> {
    try {
      const { command } = params;
      const timeoutMs = this.config.tools.exec.timeout * 1000;

      logger.info(`Executing command: ${command}`);

      // 检查命令是否在允许列表中
      const commandName = command.split(' ')[0] ?? command;
      const allowedCommands = this.config.tools.exec.allowedCommands;
      if (allowedCommands.length > 0 && !allowedCommands.includes(commandName)) {
        return `Error: Command "${commandName}" not in allowlist`;
      }

      // 执行命令 (带超时)。使用 shell: true 以兼容 Windows（cmd）与 Unix（sh）
      const result = await withTimeout(
        execaCommand(command, { shell: true }),
        timeoutMs,
        `Command execution timeout (${this.config.tools.exec.timeout}s)`
      );

      // 组合输出
      let output = '';

      if (result.stdout) {
        output += result.stdout;
      }

      if (result.stderr) {
        output += '\n' + result.stderr;
      }

      // 包含退出码
      if (result.exitCode !== 0) {
        output += `\n[exit code: ${result.exitCode}]`;
      }

      return output.trim();
    } catch (error) {
      const errorMsg = `Command execution failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `Error: ${errorMsg}`;
    }
  }
}
