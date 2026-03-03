import { useEffect, useRef } from 'react';
import { theme } from '../theme';
import { MessageContent } from './MessageContent';
import { EmptyBorder } from './Border';

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
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';

        if (isUser) {
          // 用户消息：左侧指示条 + 背景色
          return (
            <box
              key={i}
              border={['left']}
              borderColor={theme.primary}
              customBorderChars={{
                ...EmptyBorder,
                vertical: '┃',
                bottomLeft: '╹',
              }}
            >
              <box
                flexDirection="column"
                paddingY={1}
                paddingLeft={2}
                width="100%"
                backgroundColor={theme.backgroundElement}
              >
               
                <MessageContent content={msg.content} />
              </box>
            </box>
          );
        }

        // Bot 消息：无指示条
        return (
          <box
            key={i}
            flexDirection="column"
            paddingY={1}
            paddingLeft={2}
            width="100%"
          >
           
            <MessageContent content={msg.content} />
          </box>
        );
      })}
    </scrollbox>
  );
}
