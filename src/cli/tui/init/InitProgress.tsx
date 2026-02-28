import { theme } from '../theme';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export interface StepResult {
  name: string;
  status: StepStatus;
  message?: string | undefined;
}

interface InitProgressProps {
  steps: StepResult[];
}

export function InitProgress({ steps }: InitProgressProps) {
  return (
    <box flexDirection="column" gap={1}>
      {steps.map((s, i) => (
        <box key={i} flexDirection="row" gap={1}>
          <text
            fg={
              s.status === 'done'
                ? theme.success
                : s.status === 'error'
                  ? theme.error
                  : s.status === 'running'
                    ? theme.accent
                    : theme.textMuted
            }
          >
            {s.status === 'done' ? '[OK]' : s.status === 'error' ? '[ERR]' : s.status === 'running' ? '...' : '[ ]'}{' '}
          </text>
          <text fg={theme.text}>{s.name}</text>
          {s.message ? (
            <text fg={theme.textMuted}> {s.message}</text>
          ) : null}
        </box>
      ))}
    </box>
  );
}
