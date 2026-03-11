import { useState, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';

export interface ApprovalFormProps {
  enabled: boolean;
  onChange?: (enabled: boolean) => void;
}

export function ApprovalForm({ enabled, onChange }: ApprovalFormProps) {
  const [focusedOption, setFocusedOption] = useState<'enable' | 'disable'>(enabled ? 'enable' : 'disable');

  useEffect(() => {
    setFocusedOption(enabled ? 'enable' : 'disable');
  }, [enabled]);

  useKeyboard(key => {
    if (key.name === 'up' || key.name === 'down') {
      setFocusedOption(prev => (prev === 'enable' ? 'disable' : 'enable'));
      return;
    }
    if (key.name === 'space' && onChange) {
      onChange(focusedOption === 'enable');
      return;
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>是否启用工具确认机制？</text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <box flexDirection="row" gap={1} alignItems="center">
          <box flexDirection="row" paddingLeft={0}>
            <text fg={focusedOption === 'enable' ? theme.primary : theme.textMuted}>
              {focusedOption === 'enable' ? '●' : ' '}
            </text>
            <text paddingLeft={1} fg={enabled ? theme.primary : theme.text}>
              {enabled ? '[●]' : '[ ]'} 启用（推荐）
            </text>
          </box>
          <text paddingLeft={2} fg={theme.textTertiary}>
            (敏感操作（如执行命令、删除文件）需要人工确认)
          </text>
        </box>
        <box flexDirection="row" gap={1} alignItems="center">
          <box flexDirection="row" paddingLeft={0}>
            <text fg={focusedOption === 'disable' ? theme.primary : theme.textMuted}>
              {focusedOption === 'disable' ? '●' : ' '}
            </text>
            <text paddingLeft={1} fg={!enabled ? theme.primary : theme.text}>
              {!enabled ? '[●]' : '[ ]'} 禁用
            </text>
          </box>
          <text paddingLeft={2} fg={theme.textTertiary}>
            (所有工具可直接执行，适合完全信任的环境)
          </text>
        </box>
      </box>
      <box paddingTop={2}>
        <text fg={theme.textTertiary}>按 [↑/↓] 选择，按 [空格] 确认，按 [Enter] 下一步</text>
      </box>
    </box>
  );
}
