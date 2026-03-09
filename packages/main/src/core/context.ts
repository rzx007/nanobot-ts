/**
 * 提示词构建器
 *
 * 为 LLM 构建完整的提示词上下文
 * 参考 Python nanobot agent/context.py
 */

import path from 'path';
import os from 'os';
import type { SessionMessage } from '../storage';
import type { SkillInfo } from '@nanobot/skills';
import { expandHome } from '@nanobot/utils';

/** Bootstrap 文件列表 */
const BOOTSTRAP_FILES = [
  ['AGENTS.md', 'AGENTS.md'],
  ['SOUL.md', 'SOUL.md'],
  ['USER.md', 'USER.md'],
  ['TOOLS.md', 'TOOLS.md'],
  ['IDENTITY.md', 'IDENTITY.md'],
] as const;

/**
 * 系统提示词构建选项
 */
export interface BuildSystemPromptOptions {
  /** 工作区路径 */
  workspace: string;

  /** 常驻技能 (always=true，完整内容) */
  alwaysSkills?: SkillInfo[];

  /** 技能摘要 (用于渐进式加载，agent 通过 read_file 按需加载) */
  skillsSummary?: string | undefined;

  /** 长期记忆内容 (MEMORY.md) */
  memoryContext?: string;
}

/**
 * 构建消息选项
 */
export interface BuildMessagesOptions {
  /** 系统提示词 */
  systemPrompt: string;

  /** 历史消息 */
  history: Array<{ role: string; content: string }>;

  /** 当前用户消息 */
  currentMessage: string;

  /** 渠道 (用于运行时上下文) */
  channel?: string;

  /** 聊天 ID */
  chatId?: string;

  /** 媒体文件路径 (图片等) */
  media?: string[];
}

/**
 * 提示词构建器
 *
 * 负责构建发送给 LLM 的完整提示词
 */
export class ContextBuilder {
  /**
   * 获取 Identity 区块 (runtime、workspace、工具指南)
   */
  static getIdentity(workspace: string): string {
    const ws = expandHome(workspace);
    const runtime = `${os.platform() === 'darwin' ? 'macOS' : os.platform()} ${os.arch()}, Node.js`;
    return `# nanobot-ts 🐱

You are nanobot-ts, a helpful AI assistant.

## Runtime
${runtime}

## Workspace
Your workspace is at: ${ws}
- Long-term memory: ${ws}/memory/MEMORY.md
- History log: ${ws}/memory/HISTORY.md (grep-searchable)
- Custom skills: ${ws}/skills/{skill-name}/SKILL.md

Reply directly with text for conversations. Only use 'message' tool to send to a specific chat channel.

## Tool Call Guidelines
- Before calling tools, you may briefly state your intent, but NEVER predict or describe expected result before receiving it.
- Before modifying a file, read it first to confirm its current content.
- Do not assume a file or directory exists — use list_dir or read_file to verify.
- After writing or editing a file, re-read it if accuracy matters.
- If a tool call fails, analyze the error before retrying with a different approach.

## Memory
- Remember important facts: write to ${ws}/memory/MEMORY.md
- Recall past events: grep ${ws}/memory/HISTORY.md`;
  }

  /**
   * 注入运行时上下文到用户消息末尾
   */
  static injectRuntimeContext(userContent: string, channel?: string, chatId?: string): string {
    const d = new Date();
    const now = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const tz = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ?? 'UTC';
    const lines = [`Current Time: ${now} (${tz})`];
    if (channel && chatId) {
      lines.push(`Channel: ${channel}`, `Chat ID: ${chatId}`);
    }
    const block = '[Runtime Context]\n' + lines.join('\n');
    return `${userContent}\n\n${block}`;
  }

  /**
   * 构建系统提示词 (Identity + Bootstrap + Memory + Skills)
   */
  static async buildSystemPrompt(options: BuildSystemPromptOptions): Promise<string> {
    const fs = await import('fs-extra');
    const workspace = expandHome(options.workspace);
    const parts: string[] = [];

    // 1. Identity
    parts.push(this.getIdentity(workspace));

    // 2. Bootstrap 文件
    let bootstrap = '';
    for (const [filename, label] of BOOTSTRAP_FILES) {
      const filePath = path.join(workspace, filename);
      try {
        if (
          await fs
            .pathExists(filePath)
            .then(() => true)
            .catch(() => false)
        ) {
          const content = await fs.readFile(filePath, 'utf-8');
          bootstrap += `\n\n## ${label}\n\n${content}`;
        }
      } catch {
        /* 忽略 */
      }
    }
    if (bootstrap) parts.push(bootstrap.trim());

    // 3. 长期记忆
    if (options.memoryContext) {
      parts.push(`# Memory\n\n${options.memoryContext}`);
    }

    // 4. 常驻技能 (完整内容)
    if (options.alwaysSkills && options.alwaysSkills.length > 0) {
      parts.push('# Always Skills');
      for (const skill of options.alwaysSkills) {
        parts.push(`\n### Skill: ${skill.name}\n\n${skill.content}`);
      }
    }

    // 5. 技能摘要 (渐进式加载)
    if (options.skillsSummary) {
      parts.push(`# Skills

The following skills extend your capabilities. To use a skill, read its SKILL.md file using read_file tool.

${options.skillsSummary}`);
    }

    return parts.join('\n\n---\n\n').trim();
  }

  /**
   * 构建消息列表 (含运行时上下文注入)
   */
  static buildMessages(options: BuildMessagesOptions): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const msg of options.history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    let userContent = options.currentMessage;
    if (options.channel !== undefined || options.chatId !== undefined) {
      userContent = this.injectRuntimeContext(userContent, options.channel, options.chatId);
    }
    messages.push({ role: 'user', content: userContent });

    return messages;
  }

  /**
   * 兼容旧 API: 仅 systemPrompt + history
   */
  static buildMessagesLegacy(
    systemPrompt: string,
    history: SessionMessage[],
  ): Array<{ role: string; content: string }> {
    const out: Array<{ role: string; content: string }> = [];
    if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
    for (const msg of history) {
      out.push({ role: msg.role, content: msg.content });
    }
    return out;
  }

  /**
   * 格式化工具调用历史
   */
  static formatToolHistory(
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
  ): string {
    if (toolCalls.length === 0) return '';
    const history = toolCalls.map(call => {
      const args = JSON.stringify(call.arguments, null, 2);
      return `- ${call.name}(${args})`;
    });
    return '工具调用历史:\n' + history.join('\n');
  }
}
