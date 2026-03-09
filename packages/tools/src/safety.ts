/**
 * 工具安全级别定义
 *
 * 为每个工具定义风险级别，用于控制确认机制的行为
 */

/**
 * 工具风险级别
 */
export enum RiskLevel {
  /** 低风险 - 无需确认 */
  LOW = 'low',
  /** 中等风险 - 首次确认，会话记忆 */
  MEDIUM = 'medium',
  /** 高风险 - 总是需要确认 */
  HIGH = 'high',
}

/**
 * 工具安全配置
 */
export interface ToolSafety {
  /** 风险级别 */
  riskLevel: RiskLevel;
  /** 安全描述 */
  description?: string;
}

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
};

/**
 * 获取工具的默认风险级别
 *
 * @param toolName - 工具名称
 * @returns 风险级别，默认为 LOW
 */
export function getDefaultRiskLevel(toolName: string): RiskLevel {
  return DEFAULT_RISK_LEVELS[toolName] ?? RiskLevel.LOW;
}

/**
 * 检查工具是否需要确认
 *
 * @param riskLevel - 风险级别
 * @returns 是否需要确认
 */
export function needsApprovalForRiskLevel(riskLevel: RiskLevel): boolean {
  return riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.MEDIUM;
}
