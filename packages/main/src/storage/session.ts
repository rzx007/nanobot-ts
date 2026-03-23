/**
 * 会话管理器模块
 *
 * 默认使用 Drizzle ORM + SQLite 存储
 * 如需使用文件系统存储，请导入 FileSessionManager
 */

// 重新导出类型
export type { Session, SessionMessage } from '@nanobot/shared';

// 导出会话管理器实现
export { DrizzleSessionManager as SessionManager } from './session-drizzle';
export { FileSessionManager } from './session-fs';
export type { SessionInfo, ChannelStats } from './session-drizzle';
