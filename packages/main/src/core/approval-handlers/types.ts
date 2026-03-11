/**
 * 审批处理器接口定义
 *
 * 定义审批处理器、消息发布等相关的接口和数据结构
 */

/**
 * 确认请求数据
 */
export interface ConfirmationRequest {
  /** 工具名称 */
  toolName: string;
  /** 工具参数 */
  params: Record<string, unknown>;
  /** 渠道名称 */
  channel: string;
  /** 聊天ID */
  chatId: string;
  /** 超时时间（秒） */
  timeout: number;
}

/**
 * 确认结果
 */
export interface ConfirmationResult {
  /** 是否批准 */
  approved: boolean;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 超时 */
  timedOut?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 审批处理器接口
 *
 * 不同渠道的审批处理器需要实现此接口
 */
export interface ApprovalHandler {
  /**
   * 请求用户确认
   *
   * @param req - 确认请求
   * @returns 确认结果
   */
  requestApproval(req: ConfirmationRequest): Promise<boolean>;

  /**
   * 处理用户回复
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @param content - 回复内容
   */
  handleUserMessage?(channel: string, chatId: string, content: string): boolean;

  /**
   * 取消待处理的确认（可选）
   *
   * @param chatId - 聊天ID
   */
  cancelPending?(chatId: string): void;
}

/**
 * 消息发布接口
 *
 * 用于消息审批处理器发送确认消息到渠道
 * 解耦消息处理器与具体消息总线实现
 */
export interface MessagePublisher {
  /**
   * 发布出站消息
   *
   * @param channel - 渠道
   * @param chatId - 聊天ID
   * @param content - 消息内容
   */
  publishOutbound(channel: string, chatId: string, content: string): Promise<void>;
}
