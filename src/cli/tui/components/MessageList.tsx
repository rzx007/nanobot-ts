import { useEffect, useRef } from 'react';
import { theme } from '../theme';
import { MessageContent } from './MessageContent';

export interface MessageItem {
  role: 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: MessageItem[];
}

type ScrollboxRefLike = { scrollToBottom?: () => void; scrollBy?: (delta: number) => void } | null;

export function MessageList({ messages }: MessageListProps) {
  const scrollboxRef = useRef<ScrollboxRefLike>(null);

  useEffect(() => {
    const scroll = scrollboxRef.current;
    if (scroll?.scrollToBottom) {
      scroll.scrollToBottom();
    } else if (typeof scroll?.scrollBy === 'function') {
      scroll.scrollBy(1e9);
    }
  }, [messages.length]);

  return (
    <scrollbox
      ref={(r: ScrollboxRefLike) => {
        scrollboxRef.current = r;
      }}
      flexGrow={1}
      flexDirection="column"
      minHeight={0}
      width="100%"
      height="100%"
      viewportOptions={{ paddingRight: 0 }}
      verticalScrollbarOptions={{
        visible: false,
      }}
    >
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
          <MessageContent content={msg.content} />
        </box>
      ))}
    </scrollbox>
  );
}
