/**
 * nanobot logs - 查看日志
 */

import path from 'path';
import fs from 'fs/promises';
import { Command } from 'commander';
import { expandHome } from '../../utils/helpers';
import { error, info } from '../ui';

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Show logs')
    .option('-t, --tail <number>', 'Number of lines to show (default: 50)', '50')
    .action(async (opts: { tail?: string }) => {
      await runLogs(parseInt(opts.tail ?? '50', 10));
    });
}

async function runLogs(tailLines: number): Promise<void> {
  const workspace = expandHome('~/.nanobot/workspace');
  const logPath = path.join(workspace, 'logs', 'nanobot.log');

  try {
    await fs.access(logPath);
  } catch {
    info(`No log file found at ${logPath}`);
    info('Logs are currently output to console only.');
    info('To enable file logging, set up a log file in the workspace.');
    return;
  }

  try {
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n');
    const linesToShow = lines.slice(-tailLines);
    info(`Last ${linesToShow.length} lines from ${logPath}:`);
    console.log('');
    console.log(linesToShow.join('\n'));
  } catch (err) {
    error(`Failed to read log file: ${err}`);
    process.exit(1);
  }
}
