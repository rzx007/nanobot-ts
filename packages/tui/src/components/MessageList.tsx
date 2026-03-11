import { useLayoutEffect, useRef } from 'react';
import { theme } from '../theme';
import { MessageContent } from './MessageContent';
import { EmptyBorder } from './Border';

export interface MessageItem {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean | undefined;
  model?: string | undefined;
  timestamp?: string | undefined;
  toolHints?: string[] | undefined;
}

interface MessageListProps {
  messages: MessageItem[];
}

type ScrollboxRefLike = { scrollToBottom?: () => void; scrollBy?: (delta: number) => void } | null;

export function MessageList({ messages }: MessageListProps) {
  const scrollboxRef = useRef<ScrollboxRefLike>(null);

  // 依赖最后一条消息的 content 长度：新消息或流式输出时都会触发滚动到底部
  const lastContentLength = messages[messages.length - 1]?.content?.length ?? 0;

  useLayoutEffect(() => {
    const scroll = scrollboxRef.current;
    if (scroll?.scrollToBottom) {
      scroll.scrollToBottom();
    } else if (typeof scroll?.scrollBy === 'function') {
      scroll.scrollBy(1e9);
    }
  }, [messages.length, lastContentLength]);

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
          <box key={i} flexDirection="column" paddingY={1} paddingLeft={2} width="100%">
            <MessageContent content={msg.content} streaming={msg.isStreaming ?? false} />

            {/* 显示工具提示 */}
            {msg.toolHints && msg.toolHints.length > 0 && (
              <box flexDirection="column" paddingTop={1}>
                {msg.toolHints.map((hint, hi) => (
                  <text key={hi} fg={theme.textMuted}>
                    🔧 {hint}
                  </text>
                ))}
              </box>
            )}

            {/* 显示模型信息 */}
            <box flexDirection="row" alignItems="center" paddingTop={1}>
              <text fg={theme.primary} marginRight={1}>
                ▣
              </text>
              <text fg={theme.textTertiary}>{msg.model}</text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
