import type { SlashCommandHandler, SlashCommandContext } from '../types';

/**
 * /help 命令处理器
 * 显示帮助信息
 */
export class HelpHandler implements SlashCommandHandler {
  id = 'help';
  label = '/help';
  description = 'Help';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { addSystemMessage } = context;

    const helpText = `**Nanobot-ts 命令**

**Slash 命令：**
- \`/new\` - 开启新会话，归档后清空当前对话历史
- \`/help\` - 显示此帮助
- \`/status\` - 查看 agent 和 gateway 状态
- \`/models\` - 切换模型
- \`/themes\` - 切换主题
- \`/sessions\` - 切换会话
- \`/skills\` - 查看技能
- \`/init\` - 创建/更新 AGENTS.md
- \`/mcps\` - 切换 MCPs
- \`/review\` - 查看变更

**快捷键：**
- \`Ctrl+P\` - 打开命令面板
- \`Esc\` - 返回首页（从 gateway/status/config）
- \`Enter\` - 发送消息
- \`Shift+Enter\` - 换行`;

    addSystemMessage(helpText);
  }
}
