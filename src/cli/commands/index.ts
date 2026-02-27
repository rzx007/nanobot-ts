/**
 * CLI 命令注册入口
 * 各子命令在单独文件中实现，此处统一组装 runCLI
 */

import { Command } from 'commander';
import { registerInitCommand } from './init';
import { registerGatewayCommand } from './gateway';
import { registerChatCommand } from './chat';
import { registerStatusCommand } from './status';
import { registerConfigCommand } from './config';
import { registerSessionCommand } from './session';
import { registerChannelsCommand } from './channels';
import { registerLogsCommand } from './logs';
import { registerWhatsAppAuthCommand } from '../whatsapp-auth';
import { registerMCPCommands } from './mcp';

export async function runCLI(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('nanobot')
    .description('Ultra-lightweight personal AI assistant')
    .version('0.1.0');

  registerInitCommand(program);
  registerGatewayCommand(program);
  registerChatCommand(program);
  registerStatusCommand(program);
  registerConfigCommand(program);
  registerSessionCommand(program);
  registerChannelsCommand(program);
  registerLogsCommand(program);
  registerWhatsAppAuthCommand(program);
  registerMCPCommands(program);

  await program.parseAsync(argv);
}

export { registerInitCommand } from './init';
export { registerGatewayCommand } from './gateway';
export { registerChatCommand } from './chat';
export { registerStatusCommand } from './status';
export { registerConfigCommand } from './config';
export { registerSessionCommand } from './session';
export { registerChannelsCommand } from './channels';
export { registerLogsCommand } from './logs';
