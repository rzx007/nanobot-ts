/**
 * 确认配置 Schema 定义
 *
 * 使用 Zod 定义确认机制的配置结构
 */

import { z } from 'zod';

/**
 * 单个工具的确认覆盖配置
 */
export const ToolApprovalOverrideSchema = z.object({
  /** 是否需要确认 */
  requiresApproval: z.boolean(),
});

/**
 * 确认配置 Schema
 */
export const ApprovalConfigSchema = z.object({
  /** 是否启用确认机制 */
  enabled: z.boolean().default(true),

  /** 会话记忆时间窗口（秒）- MEDIUM风险工具在此时间内重复操作自动确认 */
  memoryWindow: z.number().int().positive().default(300),

  /** 确认超时时间（秒） */
  timeout: z.number().int().positive().default(60),

  /** 覆盖特定工具的默认确认策略 */
  toolOverrides: z.record(z.string(), ToolApprovalOverrideSchema).default({}),

  /** 严格模式：所有非LOW风险工具都需要确认（忽略会话记忆） */
  strictMode: z.boolean().default(false),

  /** 是否启用确认日志 */
  enableLogging: z.boolean().default(true),
});

/**
 * 导出类型
 */
export type ToolApprovalOverride = z.infer<typeof ToolApprovalOverrideSchema>;
export type ApprovalConfig = z.infer<typeof ApprovalConfigSchema>;
