import { theme } from '../theme';
import type { StepStatus } from './InitProgress';

interface InitStepProps {
  title: string;
  status: StepStatus;
  detail?: string;
}

export function InitStep({ title, status, detail }: InitStepProps) {
  const symbol =
    status === 'done' ? '✓' : status === 'error' ? '✗' : status === 'running' ? '…' : '○';
  const color =
    status === 'done' ? theme.success : status === 'error' ? theme.error : theme.text;

  return (
    <box flexDirection="row" gap={1} paddingY={0}>
      <text fg={color}>{symbol}</text>
      <text fg={theme.text}>{title}</text>
      {detail != null && detail !== '' ? (
        <text fg={theme.textMuted}>{detail}</text>
      ) : null}
    </box>
  );
}
