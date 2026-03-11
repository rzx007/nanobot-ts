/**
 * CLI UI 工具
 *
 * 终端交互辅助 (ora, inquirer, chalk)
 */

import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import inquirer from 'inquirer';

/**
 * 创建 Spinner
 */
export function createSpinner(text: string): Ora {
  return ora(text);
}

/**
 * 提示用户输入
 */
export async function prompt(
  questions: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  return inquirer.prompt(questions as never) as Promise<Record<string, unknown>>;
}

/**
 * 成功消息
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * 错误消息
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), message);
}

/**
 * 警告消息
 */
export function warn(message: string): void {
  console.warn(chalk.yellow('!'), message);
}

/**
 * 信息消息
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}
