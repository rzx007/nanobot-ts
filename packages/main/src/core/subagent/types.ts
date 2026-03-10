/**
 * Subagent 类型定义
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * 子代理任务接口
 */
export interface SubagentTask {
  /** 任务唯一 ID */
  taskId: string;

  /** 任务描述 */
  task: string;

  /** 可选标签 */
  label?: string;

  /** 来源渠道 */
  originChannel: string;

  /** 来源聊天 ID */
  originChatId: string;

  /** 会话密钥 */
  sessionKey: string;

  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** 创建时间 */
  createdAt: Date;

  /** 开始时间 */
  startedAt?: Date;

  /** 完成时间 */
  completedAt?: Date;

  /** 错误信息（如果失败） */
  error?: string;

  /** 取消信号（用于中止执行） */
  abortSignal?: AbortSignal;
}

/**
 * 子代理结果接口
 */
export interface SubagentResult {
  /** 任务 ID */
  taskId: string;

  /** 执行结果 */
  result: string;

  /** 状态 */
  status: 'completed' | 'failed' | 'cancelled';

  /** 错误信息（可选） */
  error?: string;

  /** 完成时间 */
  completedAt: Date;
}

/**
 * 子代理管理器配置接口
 */
export interface SubagentManagerConfig {
  /** 完整配置对象 */
  config: import('@nanobot/shared').Config;

  /** 消息总线 */
  bus: import('../../bus').MessageBus;

  /** LLM 提供商 */
  provider: import('@nanobot/providers').LLMProvider;

  /** 工具注册表 */
  tools: import('../../tools/registry').ToolRegistry;

  /** 工作区路径 */
  workspace: string;
}

/**
 * 子代理执行模式
 */
export type SubagentMode = 'embedded' | 'isolated';

/**
 * 子代理 Worker 配置接口
 */
export interface SubagentWorkerConfig {
  /** 完整配置对象 */
  config: import('@nanobot/shared').Config;

  /** LLM 提供商 */
  provider: import('@nanobot/providers').LLMProvider;

  /** 工具注册表 */
  tools: import('../../tools/registry').ToolRegistry;

  /** 工作区路径 */
  workspace: string;

  /** 最大迭代次数 */
  maxIterations: number;

  /** 超时时间（秒） */
  timeout: number;
}
