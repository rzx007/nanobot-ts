import { z } from 'zod';

/**
 * 工具调用 - Zod  schema
 */
export const ToolCallSchema = z.object({
    /** 工具调用 ID */
    id: z.string(),

    /** 工具名称 */
    name: z.string(),

    /** 工具参数 (已解析的 JSON) */
    arguments: z.record(z.string(), z.unknown()),
});

/**
 * 工具风险级别
 */
export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);

/**
 * 工具审批配置 schema
 */
export const ToolApprovalSchema = z.object({
    /** 是否启用 */
    enabled: z.boolean(),

    /** 内存窗口 */
    memoryWindow: z.number(),

    /** 超时时间 (秒) */
    timeout: z.number(),
});

/**
 * 工具配置 schema
 */
export const ToolConfigSchema = z.object({
    /** 审批配置 */
    approval: ToolApprovalSchema,
});

/**
 * 工具注册表配置 schema
 */
export const ToolRegistryConfigSchema = z.object({
    /** 工具配置 */
    approval: ToolApprovalSchema,
});

/** 推断类型 */
export type ToolCall = z.infer<typeof ToolCallSchema>;
export type RiskLevel = z.infer<typeof RiskLevelSchema>;
export type ToolApproval = z.infer<typeof ToolApprovalSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;
export type ToolRegistryConfig = z.infer<typeof ToolRegistryConfigSchema>;

/**
 * 工具风险级别常量
 */
export const RiskLevel = {
    LOW: 'low' as const,
    MEDIUM: 'medium' as const,
    HIGH: 'high' as const,
} as const;

/**
 * 默认工具风险级别配置
 */
export const DEFAULT_RISK_LEVELS: Record<string, RiskLevel> = {
    exec: RiskLevel.HIGH,
    spawn: RiskLevel.HIGH,
    write_file: RiskLevel.MEDIUM,
    edit_file: RiskLevel.MEDIUM,
    delete_file: RiskLevel.MEDIUM,
    message: RiskLevel.MEDIUM,
    cron: RiskLevel.MEDIUM,
    read_file: RiskLevel.LOW,
    list_dir: RiskLevel.LOW,
    web_search: RiskLevel.LOW,
    web_fetch: RiskLevel.LOW,
    browser: RiskLevel.MEDIUM,
    filesystem: RiskLevel.MEDIUM,
    shell: RiskLevel.HIGH,
    hotnews: RiskLevel.LOW,
    skill: RiskLevel.LOW,
    subagent: RiskLevel.MEDIUM,
};
