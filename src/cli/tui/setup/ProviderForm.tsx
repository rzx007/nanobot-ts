import { useState, useMemo, useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { theme } from '../theme';
import {
  PROVIDER_OPTIONS,
  PROVIDER_DEFAULTS,
  PROVIDER_SKIP_OPTION,
} from './constants';
import type { ProviderConfig } from './types';

const PROVIDER_LIST = [...PROVIDER_OPTIONS, PROVIDER_SKIP_OPTION];
const SKIP_INDEX = PROVIDER_LIST.length - 1;

export interface ProviderFormProps {
  config: ProviderConfig;
  onChange: (config: ProviderConfig) => void;
  /** 告知 Wizard 当前是否在编辑（有输入框等），Wizard 会据此屏蔽全局 Enter 作为「下一步」，避免在输入框里按回车误触下一步 */
  onEditingChange?: (editing: boolean) => void;
  /** 用户选择「跳过此步骤」时调用，由 Wizard 跳转到下一步 */
  onSkipProvider?: () => void;
  /** 填好 API Key 和模型后按 Enter 时调用，由 Wizard 跳转到下一步 */
  onNext?: () => void;
  /** 为 true 时强制显示供应商列表（例如从下一步返回后） */
  providerSkipped?: boolean;
}

export function ProviderForm({
  config,
  onChange,
  onEditingChange,
  onSkipProvider,
  onNext,
  providerSkipped = false,
}: ProviderFormProps) {
  const [confirmedProvider, setConfirmedProvider] = useState<typeof config.type | null>(null);
  const [providerListIndex, setProviderListIndex] = useState(() => {
    const i = PROVIDER_OPTIONS.findIndex(p => p.value === config.type);
    return i >= 0 ? i : 0;
  });
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    if (providerSkipped) setConfirmedProvider(null);
  }, [providerSkipped]);

  const provider = useMemo(
    () => (confirmedProvider ? PROVIDER_OPTIONS.find(p => p.value === confirmedProvider) : null),
    [confirmedProvider],
  );

  useEffect(() => {
    if (confirmedProvider !== null) onEditingChange?.(true);
    return () => onEditingChange?.(false);
  }, [confirmedProvider, onEditingChange]);

  useKeyboard(key => {
    if (confirmedProvider === null) {
      if (key.name === 'up') {
        setProviderListIndex(prev => (prev > 0 ? prev - 1 : SKIP_INDEX));
        return;
      }
      if (key.name === 'down') {
        setProviderListIndex(prev => (prev < SKIP_INDEX ? prev + 1 : 0));
        return;
      }
      if (key.name === 'enter' || key.name === 'return') {
        key.preventDefault?.();
        key.stopPropagation?.();
        if (providerListIndex === SKIP_INDEX) {
          onSkipProvider?.();
          return;
        }
        const option = PROVIDER_OPTIONS[providerListIndex];
        if (!option) return;
        const defaults = PROVIDER_DEFAULTS[option.value];
        setConfirmedProvider(option.value);
        onChange({
          type: option.value,
          apiKey: config.apiKey,
          model: defaults.model ?? config.model ?? '',
          apiBase: defaults.apiBase ?? '',
        });
        return;
      }
    } else if (key.name === 'tab') {
      setFocusIndex(i => (i + 1) % 2);
    } else if (key.name === 'enter' || key.name === 'return') {
      key.preventDefault?.();
      key.stopPropagation?.();
      const model = config.model?.trim() || provider?.defaultModel;
      if (config.apiKey?.trim() && model) {
        onNext?.();
      }
    }
  });

  if (confirmedProvider === null) {
    return (
      <box flexDirection="column" gap={1}>
        <box flexDirection="column" gap={0}>
          {PROVIDER_LIST.map((item, i) => (
            <box
              key={item.value}
              flexDirection="row"

            >
              <text fg={providerListIndex === i ? theme.primary : theme.textSecondary}>
                {providerListIndex === i ? '● ' : 'o '}
              </text>
              <text
                paddingLeft={1}
                fg={providerListIndex === i ? theme.primary : theme.textSecondary}
              >
                {item.label}
              </text>
            </box>
          ))}
        </box>
        <box paddingTop={2}>
          <text fg={theme.textTertiary}>
            按 [↑/↓] 选择，[Enter] 确认
          </text>
        </box>
      </box>
    );
  }

  const defaultModel = provider?.defaultModel ?? '';

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.textMuted}>当前: {provider?.label ?? confirmedProvider}</text>
      <box paddingTop={1} flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.textMuted}>API Key: </text>
        <input
          value={config.apiKey}
          onChange={v => onChange({ ...config, apiKey: v })}
          width={100}
          focused={focusIndex === 0}
        />
      </box>
      <box paddingTop={1} flexDirection="row" alignItems="center" gap={1}>
        <text fg={theme.textMuted}>默认模型: </text>
        <input
          value={defaultModel ?? config.model ?? ''}
          onChange={v => onChange({ ...config, model: v })}
          width={40}
          focused={focusIndex === 1}
        />
      </box>
      <box paddingTop={1}>
        <text fg={theme.textTertiary}>
          {config.apiKey?.trim() && (config.model?.trim() || provider?.defaultModel)
            ? '按 [Tab] 切换字段，按 [Enter] 下一步'
            : '按 [Tab] 切换字段'}
        </text>
      </box>
    </box>
  );
}
