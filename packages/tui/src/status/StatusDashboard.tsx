import { StatusCard } from './StatusCard';
import { theme } from '../theme';

interface SessionInfo {
  key: string;
  messageCount: number;
  updatedAt: string;
}

interface StatusDashboardProps {
  configPath: string;
  workspace: string;
  sessions: SessionInfo[];
}

export function StatusDashboard({
  configPath,
  workspace,
  sessions,
}: StatusDashboardProps) {
  return (
    <box flexDirection="column" gap={1}>
      <StatusCard title="Config" value={configPath} />
      <StatusCard title="Workspace" value={workspace} />
      <StatusCard title="Sessions" value={String(sessions.length)} />
      {sessions.length > 0 ? (
        <box flexDirection="column" paddingTop={1}>
          <text fg={theme.textMuted}>Recent sessions:</text>
          {sessions.slice(0, 5).map(s => (
            <text key={s.key} fg={theme.text}>
              - {s.key} ({s.messageCount} messages)
            </text>
          ))}
        </box>
      ) : null}
    </box>
  );
}
