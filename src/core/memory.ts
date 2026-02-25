/**
 * 内存整合
 *
 * 将会话历史整合为长期记忆
 */

import path from 'path';
import fs from 'fs/promises';
import type { Config } from '../config/schema';
import type { SessionMessage, Session } from '../storage';
import { expandHome } from '../utils/helpers';
import { logger } from '../utils/logger';

/**
 * 内存整合器
 *
 * 负责将会话历史整合为长期记忆
 */
export class MemoryConsolidator {
  /** 工作区路径 */
  private workspace: string;

  /** 整合阈值 (消息数) */
  private readonly consolidationThreshold = 50;

  /**
   * 构造函数
   *
   * @param config - 配置对象
   */
  constructor(config: Config) {
    this.workspace = expandHome(config.agents.defaults.workspace);
  }

  /**
   * 整合会话记忆 (增量整合，更新 lastConsolidated，不清空会话)
   *
   * @param session - 会话对象
   * @param archiveAll - 是否归档全部 (如 /new 命令)
   */
  async consolidate(session: Session, archiveAll = false): Promise<void> {
    const { key, messages } = session;
    const lastConsolidated = session.lastConsolidated ?? 0;

    let toConsolidate: typeof messages;
    if (archiveAll) {
      toConsolidate = messages;
      logger.info(`Consolidating session memory (archive_all): ${key}, ${messages.length} messages`);
    } else {
      const keepCount = Math.floor(this.consolidationThreshold / 2);
      if (messages.length - lastConsolidated <= keepCount) return;
      toConsolidate = messages.slice(lastConsolidated, -keepCount);
      if (toConsolidate.length === 0) return;
      logger.info(`Consolidating session memory: ${key}, ${toConsolidate.length} to consolidate`);
    }

    try {
      // 读取当前 MEMORY.md
      const memoryPath = path.join(this.workspace, 'memory', 'MEMORY.md');
      const historyPath = path.join(this.workspace, 'memory', 'HISTORY.md');

      let existingMemory = '';
      let existingHistory = '';

      if (
        await fs
          .access(memoryPath)
          .then(() => true)
          .catch(() => false)
      ) {
        existingMemory = await fs.readFile(memoryPath, 'utf-8');
      }

      if (
        await fs
          .access(historyPath)
          .then(() => true)
          .catch(() => false)
      ) {
        existingHistory = await fs.readFile(historyPath, 'utf-8');
      }

      // 生成摘要 (使用简单文本提取)
      const summary = this._generateSummary(toConsolidate);

      // 格式化时间
      const timestamp = new Date().toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
      });

      // 追加到 MEMORY.md
      const memoryContent = `
## 会话摘要 (${timestamp})
- 会话: ${key}
- 消息数: ${toConsolidate.length}

### 关键内容
${summary}

---
`;

      const newMemory = existingMemory + memoryContent;
      await fs.writeFile(memoryPath, newMemory, 'utf-8');

      // 追加到 HISTORY.md
      const historyContent = `
## ${timestamp} - ${key}
${toConsolidate.map(msg => `**${msg.role}**: ${msg.content}`).join('\n\n')}

---
`;

      const newHistory = existingHistory + historyContent;
      await fs.writeFile(historyPath, newHistory, 'utf-8');

      // 更新 lastConsolidated
      session.lastConsolidated = archiveAll ? 0 : session.messages.length - Math.floor(this.consolidationThreshold / 2);

      logger.info(`Memory consolidation success: ${key}`);
    } catch (error) {
      logger.error(`Memory consolidation failed: ${session.key}, error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查是否需要整合
   *
   * @param session - 会话对象
   * @returns 是否需要整合
   */
  needsConsolidation(session: Session): boolean {
    const lastConsolidated = session.lastConsolidated ?? 0;
    const unconsolidated = session.messages.length - lastConsolidated;
    return unconsolidated >= this.consolidationThreshold;
  }

  /**
   * 生成摘要 (简单实现)
   *
   * @param messages - 消息列表
   * @returns 摘要文本
   */
  private _generateSummary(messages: SessionMessage[]): string {
    // 简单的摘要生成：提取用户的关键问题和助手的回答

    // 获取所有用户消息
    const userMessages = messages.filter(msg => msg.role === 'user').map(msg => msg.content);

    // 提取用户的关键意图
    const intents: string[] = [];
    for (const msg of userMessages) {
      // 简单的关键词提取（去除标点符号）
      const cleaned = msg
        .replace(/[.,!?;:"'()]/g, ' ')
        .trim()
        .substring(0, 50); // 限制长度

      if (cleaned && !intents.includes(cleaned)) {
        intents.push(cleaned);
      }

      if (intents.length >= 5) {
        break; // 最多提取 5 个关键意图
      }
    }

    if (intents.length === 0) {
      return '无特别内容';
    }

    return `用户关心: ${intents.join('、')}`;
  }

  /**
   * 获取记忆上下文 (用于系统提示词)
   */
  async getMemoryContext(): Promise<string> {
    const content = await this.readLongTerm();
    return content ? `## Long-term Memory\n${content}` : '';
  }

  /**
   * 读取长期记忆 (MEMORY.md)
   */
  async readLongTerm(): Promise<string> {
    const memoryPath = path.join(this.workspace, 'memory', 'MEMORY.md');
    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      return content;
    } catch {
      return '';
    }
  }

  /**
   * 在 HISTORY.md 中按关键词搜索历史
   *
   * @param keyword - 搜索关键词
   * @returns 匹配的条目 (格式化的文本)
   */
  async search(keyword: string): Promise<string> {
    const historyPath = path.join(this.workspace, 'memory', 'HISTORY.md');
    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      const lines = content.split('\n');
      const results: string[] = [];
      let currentBlock: string[] = [];
      let inBlock = false;

      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (inBlock && currentBlock.some((l) => l.toLowerCase().includes(keyword.toLowerCase()))) {
            results.push(currentBlock.join('\n'));
          }
          currentBlock = [line];
          inBlock = true;
        } else if (inBlock) {
          currentBlock.push(line);
        }
      }
      if (inBlock && currentBlock.some((l) => l.toLowerCase().includes(keyword.toLowerCase()))) {
        results.push(currentBlock.join('\n'));
      }

      return results.length > 0 ? results.join('\n\n---\n\n') : `未找到包含「${keyword}」的历史记录`;
    } catch {
      return '暂无历史记录';
    }
  }
}
