import type { ReactNode } from 'react';
import type { Config } from '@/config/schema';
import type { Runtime } from '@/core';

/**
 * Dialog 数据结构
 */

/**
 * 状态信息
 */
export interface StatusInfo {
  /** Agent 运行时状态 */
  agentStatus: 'running' | 'stopped' | 'error';
  /** Agent 模型 ID */
  agentModel: string;
  /** Agent 会话 ID */
  agentSession: string | null;
  /** Gateway 状态 */
  gatewayStatus: 'connected' | 'disconnected' | 'error';
  /** Gateway URL */
  gatewayUrl: string | null;
  /** Gateway 消息数量 */
  gatewayMessages: number;
  /** 配置信息 */
  config: {
    theme: string;
    language: string;
  };
}

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;
  /** 模型名称 */
  name: string;
  /** 模型提供商 */
  provider: string;
  /** 模型描述 */
  description: string;
  /** 是否为当前使用的模型 */
  current?: boolean;
}

/**
 * MCP 服务信息
 */
export interface McpInfo {
  /** MCP ID */
  id: string;
  /** MCP 名称 */
  name: string;
  /** MCP 描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
  /** MCP 版本（可选） */
  version?: string;
}

/**
 * 技能信息
 */
export interface SkillInfo {
  /** 技能 ID */
  id: string;
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 技能版本（可选） */
  version?: string;
  /** 技能作者（可选） */
  author?: string;
}

/**
 * Dialog 组件 Props
 */

/**
 * StatusDialog Props
 */
export interface StatusDialogProps {
  /** Agent 运行时实例 */
  runtime: Runtime | null;
  /** 配置对象 */
  config: Config | null;
}

/**
 * HelpDialog Props
 */
export interface HelpDialogProps {
  /** 自定义帮助内容（可选） */
  customContent?: ReactNode;
}

/**
 * ModelsDialog Props
 */
export interface ModelsDialogProps {
  /** 当前模型 ID */
  currentModel: string;
  /** 可用模型列表 */
  models: ModelInfo[];
  /** 选择模型回调 */
  onSelectModel: (modelId: string) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * McpDialog Props
 */
export interface McpDialogProps {
  /** MCP 列表 */
  mcps: McpInfo[];
  /** 切换 MCP 启用状态回调 */
  onToggleMcp: (mcpId: string, enabled: boolean) => void;
  /** 应用更改回调 */
  onApplyChanges: (enabledMcps: string[]) => void;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * SkillsDialog Props
 */
export interface SkillsDialogProps {
  /** 技能列表 */
  skills: SkillInfo[];
  /** 选中技能回调 */
  onSelectSkill: (skillId: string) => void;
  /** 刷新技能列表回调（可选） */
  onRefresh?: (() => void) | (() => Promise<void>) | undefined;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * Dialog 创建函数类型
 */

/**
 * 创建状态 Dialog
 */
export interface CreateStatusDialogParams {
  runtime: Runtime | null;
  config: Config | null;
}

/**
 * 创建帮助 Dialog
 */
export interface CreateHelpDialogParams {
  customContent?: ReactNode;
}

/**
 * 创建模型选择 Dialog
 */
export interface CreateModelsDialogParams {
  currentModel: string;
  models: ModelInfo[];
  onSelectModel: (modelId: string) => void;
}

/**
 * 创建 MCP 切换 Dialog
 */
export interface CreateMcpDialogParams {
  mcps: McpInfo[];
  onToggleMcp: (mcpId: string, enabled: boolean) => void;
  onApplyChanges: (enabledMcps: string[]) => void;
}

/**
 * 创建技能查看 Dialog
 */
export interface CreateSkillsDialogParams {
  skills: SkillInfo[];
  onSelectSkill: (skillId: string) => void;
  onRefresh?: () => void;
}

/**
 * Dialog 创建函数返回类型
 */
export interface DialogCreatorResult {
  /** Dialog 元素 */
  element: ReactNode;
  /** 关闭回调（可选） */
  onClose?: () => void;
}
