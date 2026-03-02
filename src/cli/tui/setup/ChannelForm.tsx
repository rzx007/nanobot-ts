import { useState } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';
import type { ChannelConfig } from './types';

export interface ChannelFormProps {
  config: ChannelConfig;
  onChange: (config: ChannelConfig) => void;
}

export function ChannelForm({ config, onChange }: ChannelFormProps) {
  const [focusedChannel, setFocusedChannel] = useState<'whatsapp' | 'feishu' | 'email'>('whatsapp');

  useKeyboard(key => {
    if (key.name === 'tab') {
      if (focusedChannel === 'whatsapp') setFocusedChannel('feishu');
      else if (focusedChannel === 'feishu') setFocusedChannel('email');
      else if (focusedChannel === 'email') setFocusedChannel('whatsapp');
      return;
    }

    if (key.name === 'up') {
      if (focusedChannel === 'whatsapp') setFocusedChannel('email');
      else if (focusedChannel === 'feishu') setFocusedChannel('whatsapp');
      else if (focusedChannel === 'email') setFocusedChannel('feishu');
      return;
    }

    if (key.name === 'down') {
      if (focusedChannel === 'whatsapp') setFocusedChannel('feishu');
      else if (focusedChannel === 'feishu') setFocusedChannel('email');
      else if (focusedChannel === 'email') setFocusedChannel('whatsapp');
      return;
    }

    if (key.name === 'space') {
      if (focusedChannel === 'whatsapp') {
        onChange({ ...config, whatsapp: { enabled: !config.whatsapp.enabled } });
      } else if (focusedChannel === 'feishu') {
        onChange({ ...config, feishu: { enabled: !config.feishu.enabled } });
      } else if (focusedChannel === 'email') {
        onChange({ ...config, email: { enabled: !config.email.enabled } });
      }
      return;
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>配置消息渠道（可选）：</text>
      <box flexDirection="column" gap={0}>
        <box
          flexDirection="row"
          paddingLeft={0}
          onMouseDown={() => setFocusedChannel('whatsapp')}
        >
          <text
            fg={focusedChannel === 'whatsapp' ? theme.accent : theme.textMuted}
            onMouseDown={() => setFocusedChannel('whatsapp')}
          >
            {focusedChannel === 'whatsapp' ? '●' : ' '}
          </text>
          <text
            paddingLeft={1}
            fg={config.whatsapp.enabled ? theme.accent : theme.text}
            onMouseDown={() => setFocusedChannel('whatsapp')}
          >
            WhatsApp {config.whatsapp.enabled ? '(启用)' : '(禁用)'}
          </text>
        </box>
        <box
          flexDirection="row"
          paddingLeft={0}
          onMouseDown={() => setFocusedChannel('feishu')}
        >
          <text fg={focusedChannel === 'feishu' ? theme.accent : theme.textMuted}>
            {focusedChannel === 'feishu' ? '●' : ' '}
          </text>
          <text
            paddingLeft={1}
            fg={config.feishu.enabled ? theme.accent : theme.text}
            onMouseDown={() => setFocusedChannel('feishu')}
          >
            飞书 {config.feishu.enabled ? '(启用)' : '(禁用)'}
          </text>
        </box>
        <box
          flexDirection="row"
          paddingLeft={0}
          onMouseDown={() => setFocusedChannel('email')}
        >
          <text fg={focusedChannel === 'email' ? theme.accent : theme.textMuted}>
            {focusedChannel === 'email' ? '●' : ' '}
          </text>
          <text
            paddingLeft={1}
            fg={config.email.enabled ? theme.accent : theme.text}
            onMouseDown={() => setFocusedChannel('email')}
          >
            Email {config.email.enabled ? '(启用)' : '(禁用)'}
          </text>
        </box>
      </box>

      <box paddingTop={2}>
        <text fg={theme.textTertiary}>按 [↑/↓] 选择渠道，按 [空格] 启用/禁用，按 [Enter] 完成</text>
      </box>
    </box>
  );
}
