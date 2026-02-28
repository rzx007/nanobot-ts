import { theme } from '../theme';

export interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: MessageItem[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <scrollbox flexGrow={1} flexDirection="column">
      {messages.map((msg, i) => (
        <box
          key={i}
          flexDirection="column"
          paddingY={1}
          border
          borderStyle="single"
          borderColor={theme.border}
        >
          <text fg={msg.role === 'user' ? theme.accent : theme.textMuted}>
            {msg.role === 'user' ? 'You' : 'Bot'}
          </text>
          <text fg={theme.text}>{msg.content}</text>
        </box>
      ))}
    </scrollbox>
  );
}
