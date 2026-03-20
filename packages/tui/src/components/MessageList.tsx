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
  reasoning?: { content: string; duration: number } | undefined;
  toolCalls?: Array<{
    name: string;
    status: 'running' | 'success' | 'error';
    result?: string;
    error?: string;
  }>;
  steps?: Array<{
    stepIndex: number;
    text: string;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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
            {/* Reasoning 折叠展示 */}
            {msg.reasoning && (
              <box flexDirection="column" paddingTop={1}>
                <text fg={theme.textMuted}>
                  🤔 <text>Thinking</text>
                </text>
                <box paddingLeft={2}>
                  <text fg={theme.textMuted}>{msg.reasoning.content.slice(0, 300)}</text>
                  {msg.reasoning.content.length > 300 && <text fg={theme.textMuted}>...</text>}
                </box>
              </box>
            )}

            <MessageContent content={msg.content} streaming={msg.isStreaming ?? false} />

            {/* 工具调用展示 */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <box flexDirection="column" paddingTop={1}>
                <text fg={theme.primary}>🔧 Tools</text>
                {msg.toolCalls.map((tool, ti) => (
                  <box key={ti} flexDirection="column" paddingLeft={2} paddingTop={1}>
                    <text>
                      {tool.status === 'running' && '⏳ '}
                      {tool.status === 'success' && '✅ '}
                      {tool.status === 'error' && '❌ '}
                      {tool.name}
                    </text>
                    {tool.result && (
                      <text fg={theme.textMuted} paddingLeft={4}>
                        {tool.result.slice(0, 100)}{tool.result.length > 100 ? '...' : ''}
                      </text>
                    )}
                    {tool.error && (
                      <text fg="red" paddingLeft={4}>
                        {tool.error}
                      </text>
                    )}
                  </box>
                ))}
              </box>
            )}

            {/* 多步调用展示 */}
            {msg.steps && msg.steps.length > 0 && (
              <box flexDirection="column" paddingTop={1}>
                <text fg={theme.primary}>📋 Steps</text>
                {msg.steps.map((step, si) => (
                  <box key={si} flexDirection="column" paddingLeft={2} paddingTop={1}>
                    <text fg={theme.textMuted}>Step {step.stepIndex}:</text>
                    <text paddingLeft={4}>{step.text.slice(0, 100)}</text>
                    {step.text.length > 100 && <text fg={theme.textMuted}>...</text>}
                  </box>
                ))}
              </box>
            )}

            {/* 使用统计 */}
            {msg.usage && (
              <box flexDirection="row" alignItems="center" paddingTop={1}>
                <text fg={theme.textMuted}>
                  📊 {msg.usage.totalTokens} tokens (In: {msg.usage.promptTokens}, Out: {msg.usage.completionTokens})
                </text>
              </box>
            )}

            {/* 模型信息 */}
            <box flexDirection="row" alignItems="center" paddingTop={1}>
              <text fg={theme.primary} marginRight={1}>
                ▣
              </text>
              <text fg={theme.textMuted}>{msg.model}</text>
            </box>
          </box>
        );
      })}
    </scrollbox>
  );
}
