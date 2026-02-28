import { theme } from '../theme';

interface StatusCardProps {
  title: string;
  value: string;
}

export function StatusCard({ title, value }: StatusCardProps) {
  return (
    <box
      border
      borderStyle="single"
      borderColor={theme.border}
      padding={1}
      flexDirection="column"
    >
      <text fg={theme.textMuted}>{title}</text>
      <text fg={theme.text}>{value}</text>
    </box>
  );
}
