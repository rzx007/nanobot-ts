import { theme } from '../theme';

interface ConfigFormProps {
  keyPath: string;
  value: string;
}

export function getNested(config: Record<string, unknown>, keyPath: string): unknown {
  const parts = keyPath.split('.');
  let cur: unknown = config;
  for (const p of parts) {
    cur = (cur as Record<string, unknown>)?.[p];
  }
  return cur;
}

export function ConfigForm({ keyPath, value }: ConfigFormProps) {
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <text fg={theme.textMuted}>Key:</text>
        <text fg={theme.accent}>{keyPath}</text>
      </box>
      <box flexDirection="column">
        <text fg={theme.textMuted}>Value:</text>
        <text fg={theme.text}>{value}</text>
      </box>
    </box>
  );
}
