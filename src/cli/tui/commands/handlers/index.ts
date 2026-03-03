import type { SlashCommandHandler } from '../types';
import { NewSessionHandler } from './NewSessionHandler';
import { StatusHandler } from './StatusHandler';
import { HelpHandler } from './HelpHandler';
import { ModelsHandler } from './ModelsHandler';
import { ThemesHandler } from './ThemesHandler';
import { SessionsHandler } from './SessionsHandler';
import { InitHandler } from './InitHandler';
import { McpsHandler } from './McpsHandler';
import { ReviewHandler } from './ReviewHandler';
import { SkillsHandler } from './SkillsHandler';

/**
 * 创建所有可用的 Slash 命令处理器
 * @returns 命令处理器数组
 */
export function createAllHandlers(): SlashCommandHandler[] {
  return [
    // 已实现的命令
    new NewSessionHandler(),
    new StatusHandler(),
    new HelpHandler(),
    new ModelsHandler(),
    new ThemesHandler(),
    new SessionsHandler(),

    // 未实现的命令（execute 空实现）
    new InitHandler(),
    new McpsHandler(),
    new ReviewHandler(),
    new SkillsHandler(),
  ];
}

// 导出各个处理器
export { NewSessionHandler } from './NewSessionHandler';
export { StatusHandler } from './StatusHandler';
export { HelpHandler } from './HelpHandler';
export { ModelsHandler } from './ModelsHandler';
export { ThemesHandler } from './ThemesHandler';
export { SessionsHandler } from './SessionsHandler';
export { InitHandler } from './InitHandler';
export { McpsHandler } from './McpsHandler';
export { ReviewHandler } from './ReviewHandler';
export { SkillsHandler } from './SkillsHandler';
