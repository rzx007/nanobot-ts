import { useState, useMemo } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';
import { CHANNEL_LABELS } from './constants';
import type { ChannelConfig } from './types';

function channelLabel(key: string): string {
  return CHANNEL_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '));
}

export interface ChannelFormProps {
  config: ChannelConfig;
  onChange: (config: ChannelConfig) => void;
}

export function ChannelForm({ config, onChange }: ChannelFormProps) {
  const channelKeys = useMemo(() => Object.keys(config), [config]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const focusedKey = channelKeys[focusedIndex] ?? channelKeys[0];

  useKeyboard(key => {
    if (channelKeys.length === 0) return;
    if (key.name === 'tab' || key.name === 'down') {
      setFocusedIndex(i => (i + 1) % channelKeys.length);
      return;
    }
    if (key.name === 'up') {
      setFocusedIndex(i => (i - 1 + channelKeys.length) % channelKeys.length);
      return;
    }
    if (key.name === 'space' && focusedKey) {
      onChange({
        ...config,
        [focusedKey]: { enabled: !config[focusedKey]?.enabled },
      });
      return;
    }
  });

  if (channelKeys.length === 0) {
    return (
      <box flexDirection="column" gap={1}>
        <text fg={theme.textMuted}>暂无渠道配置</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>配置消息渠道（可选）：</text>
      <box flexDirection="column" gap={0}>
        {channelKeys.map(key => (
          <box
            key={key}
            flexDirection="row"
            paddingLeft={0}
            onMouseDown={() => setFocusedIndex(channelKeys.indexOf(key))}
          >
            <text
              fg={focusedKey === key ? theme.primary : theme.textMuted}
              onMouseDown={() => setFocusedIndex(channelKeys.indexOf(key))}
            >
              {focusedKey === key ? '● ' : 'o '}
            </text>
            <text
              paddingLeft={1}
              fg={config[key]?.enabled ? theme.primary : theme.text}
              onMouseDown={() => setFocusedIndex(channelKeys.indexOf(key))}
            >
              {channelLabel(key)} {config[key]?.enabled ? '(启用)' : '(禁用)'}
            </text>
          </box>
        ))}
      </box>

      <box paddingTop={2}>
        <text fg={theme.textTertiary}>按 [↑/↓] 选择渠道，按 [空格] 启用/禁用，按 [Enter] 完成</text>
      </box>
    </box>
  );
}
