import { useDialog } from '../../components/Dialog';
import type { HelpDialogProps } from './types';

/**
 * 帮助信息 Dialog
 * 显示命令列表和快捷键说明
 */
export function HelpDialog({ customContent }: HelpDialogProps) {
  const dialog = useDialog();

  if (customContent) {
    return <box>{customContent}</box>;
  }

  return (
    <box gap={1} paddingBottom={1}>
      {/* Header */}
      <box paddingLeft={2} paddingRight={2}>
        <box flexDirection="row" justifyContent="space-between">
          <text>Help</text>
          <text fg="#a0a0a0" onMouseUp={() => dialog.clear()}>
            esc
          </text>
        </box>
      </box>

      {/* Slash Commands */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#e94560">
          Slash Commands
        </text>
        <box paddingLeft={2}>
          <text>
            /new       - 开启新会话，归档后清空当前对话历史
          </text>
          <text>/help      - 显示此帮助</text>
          <text>/status    - 查看 agent 和 gateway 状态</text>
          <text>/models    - 切换模型</text>
          <text>/themes    - 切换主题</text>
          <text>/sessions  - 切换会话</text>
          <text>/skills    - 查看技能</text>
          <text>/init      - 创建/更新 AGENTS.md</text>
          <text>/mcps      - 切换 MCPs</text>
          <text>/review    - 查看变更</text>
        </box>
      </box>

      {/* Keyboard Shortcuts */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#16213e">
          Keyboard Shortcuts
        </text>
        <box paddingLeft={2}>
          <text>Ctrl+P      - 打开命令面板</text>
          <text>Esc         - 返回首页（从 gateway/status/config）</text>
          <text>Enter       - 发送消息</text>
          <text>Shift+Enter - 换行</text>
        </box>
      </box>

      {/* Tips */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg="#0f3460">
          Tips
        </text>
        <box paddingLeft={2}>
          <text>• 输入 / 可快速查看所有可用命令</text>
          <text>• 使用 ↑↓ 键在命令列表中导航</text>
          <text>• 按 Esc 关闭任何 Dialog</text>
        </box>
      </box>
    </box>
  );
}
