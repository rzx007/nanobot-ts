import type { SlashCommandHandler, SlashCommandContext } from '../types';
import { createMcpDialog } from '../dialogs';
import type { McpInfo } from '../dialogs/types';

/**
 * 可用的 MCP 列表
 * TODO: 从配置或运行时中读取
 */
const AVAILABLE_MCPS: McpInfo[] = [
  {
    id: '@browser',
    name: 'Browser',
    description: 'Web 浏览器访问',
    enabled: true,
  },
  {
    id: '@filesystem',
    name: 'Filesystem',
    description: '文件系统访问',
    enabled: true,
  },
  {
    id: '@database',
    name: 'Database',
    description: '数据库连接',
    enabled: false,
  },
  {
    id: '@pencil',
    name: 'Pencil',
    description: 'Pencil 设计工具',
    enabled: true,
  },
];

/**
 * /mcps 命令处理器
 * 使用 Dialog 切换 MCP 服务
 */
export class McpsHandler implements SlashCommandHandler {
  id = 'mcps';
  label = '/mcps';
  description = 'Toggle MCPs';
  category = 'system' as const;

  async execute(context: SlashCommandContext): Promise<void> {
    const { openDialog, addSystemMessage } = context;

    // 创建并打开 MCP 切换 Dialog
    const { element } = createMcpDialog({
      mcps: AVAILABLE_MCPS,
      onToggleMcp: (mcpId: string, enabled: boolean) => {
        // TODO: 实时更新 MCP 启用状态
        addSystemMessage(`MCP ${mcpId} ${enabled ? '已启用' : '已禁用'}`);
      },
      onApplyChanges: (enabledMcps: string[]) => {
        // TODO: 应用更改到配置
        addSystemMessage(`已应用 MCP 配置: ${enabledMcps.join(', ')}`);
      },
    });

    openDialog(element);
  }
}
