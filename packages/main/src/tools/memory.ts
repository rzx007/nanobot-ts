/**
 * 历史搜索工具
 *
 * 基于 SQLite 搜索历史消息的工具实现
 */

import { Tool } from './base';
import type { SessionManager } from '../storage';
import { RiskLevel } from './safety';
import { like, and, desc, gt, eq } from 'drizzle-orm';
import { sessions, sessionMessages } from '../storage/schema/schema';
import { logger } from '@nanobot/logger';

/**
 * 历史搜索工具
 */
export class SearchHistoryTool extends Tool {
  name = 'search_history';

  description = `搜索历史消息记录。

使用场景：
- 回顾过去的对话内容
- 查找特定关键词的讨论
- 按时间范围查找消息
- 按渠道过滤消息

支持查询：
- 关键词搜索（模糊匹配）
- 按渠道过滤（channel: 'cli', 'telegram', 'discord', 'web' 等）
- 按天数范围过滤（days: N，最近 N 天的消息）
- 结果数量限制（limit: N，默认 20）`;

  riskLevel = RiskLevel.LOW;

  private sessionManager: SessionManager | null = null;

  parameters = {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        description: '搜索关键词（模糊匹配消息内容）',
      },
      channel: {
        type: 'string',
        description: '按渠道过滤（可选）: cli, telegram, discord, web 等',
      },
      days: {
        type: 'number',
        description: '时间范围：最近 N 天的消息（可选，默认 30）',
      },
      limit: {
        type: 'number',
        description: '返回结果数量限制（可选，默认 20）',
      },
    },
    required: ['keyword'],
  };

  /**
   * 设置会话管理器
   */
  setSessionManager(manager: SessionManager): void {
    this.sessionManager = manager;
  }

  /**
   * 执行历史搜索
   */
  async execute(params: {
    keyword: string;
    channel?: string;
    days?: number;
    limit?: number;
  }): Promise<string> {
    try {
      if (!this.sessionManager) {
        return '错误：会话管理器未初始化';
      }

      const { keyword, channel, days = 30, limit = 20 } = params;

      logger.info(`Searching history: keyword="${keyword}", channel="${channel ?? 'all'}", days=${days}, limit=${limit}`);

      // 获取数据库实例
      const db = (this.sessionManager as any).db;

      if (!db) {
        return '错误：无法访问数据库';
      }

      // 构建查询条件
      const conditions = [];

      // 关键词搜索（模糊匹配）
      if (keyword) {
        conditions.push(like(sessionMessages.content, `%${keyword}%`));
      }

      // 时间范围
      if (days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        conditions.push(gt(sessionMessages.timestamp, cutoffDate.toISOString()));
      }

      // 渠道过滤
      const sessionQuery = channel
        ? and(eq(sessions.channel, channel), ...conditions)
        : and(...conditions);

      // 执行查询
      const results = await db
        .select({
          message: sessionMessages,
          session: {
            key: sessions.key,
            channel: sessions.channel,
            chatId: sessions.chatId,
          },
        })
        .from(sessionMessages)
        .innerJoin(sessions, eq(sessions.key, sessionMessages.sessionKey))
        .where(sessionQuery as any)
        .orderBy(desc(sessionMessages.timestamp))
        .limit(limit)
        .all();

      if (results.length === 0) {
        return `未找到包含「${keyword}」的历史记录`;
      }

      // 格式化结果
      const formatted = results.map((r: any) => {
        const date = new Date(r.message.timestamp).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });

        return `## [${date}] ${r.session.channel}:${r.session.chatId}

**${r.message.role}**: ${r.message.content}`;
      });

      return formatted.join('\n\n---\n\n');
    } catch (error) {
      const errorMsg = `Search history failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      return `错误：${errorMsg}`;
    }
  }
}
