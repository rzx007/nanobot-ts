/**
 * Tool 相关类型
 */

export interface ToolCall {
  /** 工具调用 ID */
  id: string;

  /** 工具名称 */
  name: string;

  /** 工具参数 (已解析的 JSON) */
  arguments: Record<string, unknown>;
}

export type RiskLevel = 'low' | 'medium' | 'high';

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

export interface ToolConfig {
  /** 审批配置 */
  approval: {
    /** 是否启用 */
    enabled: boolean;

    /** 内存窗口 */
    memoryWindow: number;

    /** 超时时间 (秒) */
    timeout: number;
  };
}

export interface ToolRegistryConfig {
  /** 工具配置 */
  approval: ToolConfig['approval'];
}
