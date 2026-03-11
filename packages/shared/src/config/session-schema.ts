import { z } from 'zod';
import { ToolCallSchema } from './tool-schema';

export const SessionMessageSchema = z.object({
    /** 角色 (user/assistant/system) */
    role: z.enum(['user', 'assistant', 'system']),

    /** 消息内容 */
    content: z.string(),

    /** 时间戳 */
    timestamp: z.string(),

    /** 工具调用信息 */
    toolCalls: z.array(ToolCallSchema).optional(),

    /** 工具调用 ID */
    toolCallId: z.string().optional(),

    /** 模型名称 */
    model: z.string().optional(),
});

export const SessionSchema = z.object({
    /** 会话密钥 */
    key: z.string(),

    /** 消息列表 */
    messages: z.array(SessionMessageSchema),

    /** 已整合到长期记忆的消息数量 (用于增量整合) */
    lastConsolidated: z.number(),

    /** 创建时间 */
    createdAt: z.string(),

    /** 更新时间 */
    updatedAt: z.string(),
});

export type SessionMessage = z.infer<typeof SessionMessageSchema>;
export type Session = z.infer<typeof SessionSchema>;