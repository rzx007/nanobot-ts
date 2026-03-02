import { theme } from '../theme';
import type { SelfCheckResult } from './types';

export interface CheckErrorProps {
  result: SelfCheckResult;
  onRetry?: () => void;
  onSetup?: () => void;
}

export function CheckError({ result, onRetry, onSetup }: CheckErrorProps) {
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="column" gap={0}>
        <text fg={theme.accent}>自检结果</text>
        {result.results.map((r, i) => (
          <box key={i} flexDirection="row">
            <text width={10}>{r.name}:</text>
            <text
              fg={
                r.status === 'done'
                  ? theme.success
                  : r.status === 'error'
                    ? theme.error
                    : theme.warn
              }
            >
              {r.status === 'done' ? '✓' : r.status === 'error' ? '✗' : '⏳'}
            </text>
            {r.message && (
              <text paddingLeft={1} fg={theme.textMuted}>
                {r.message}
              </text>
            )}
          </box>
        ))}
      </box>

      {result.errors.length > 0 && (
        <box flexDirection="column" gap={0} paddingTop={1}>
          <text fg={theme.error}>错误:</text>
          {result.errors.map((err, i) => (
            <text key={i} paddingLeft={2} fg={theme.error}>
              • {err}
            </text>
          ))}
        </box>
      )}

      {result.warnings.length > 0 && (
        <box flexDirection="column" gap={0} paddingTop={1}>
          <text fg={theme.warn}>警告:</text>
          {result.warnings.map((warn, i) => (
            <text key={i} paddingLeft={2} fg={theme.warn}>
              • {warn}
            </text>
          ))}
        </box>
      )}

      {result.canProceed ? (
        <box paddingTop={2}>
          <text fg={theme.success}>配置完整，可以继续使用</text>
        </box>
      ) : (
        <box flexDirection="column" gap={1} paddingTop={2}>
          <text fg={theme.error}>配置不完整，需要修复</text>
          {onSetup && (
            <box flexDirection="row" gap={2}>
              <box onMouseDown={onSetup}>
                <text fg={theme.accent}>[运行配置向导]</text>
              </box>
              {onRetry && (
                <box onMouseDown={onRetry}>
                  <text fg={theme.text}>[重新检查]</text>
                </box>
              )}
            </box>
          )}
        </box>
      )}
    </box>
  );
}
