import { useState, useEffect, useRef } from 'react';
import { loadConfig } from '@/config/loader';
import { buildAgentRuntime } from '../../setup';
import type { MessageItem } from '../components/MessageList';
import { Layout } from '../components/Layout';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { theme } from '../theme';

export function ChatApp({
  prompt: initialPrompt,
  interactive: _interactive,
}: {
  prompt?: string | undefined;
  interactive?: boolean | undefined;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputDisabled, setInputDisabled] = useState(false);
  const runtimeRef = useRef<Awaited<ReturnType<typeof buildAgentRuntime>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await loadConfig();
      if (cancelled) return;
      if (!config) {
        setError('No config found. Run "nanobot init" first.');
        setLoading(false);
        return;
      }
      try {
        const runtime = await buildAgentRuntime(config);
        if (cancelled) return;
        runtimeRef.current = runtime;
        setLoading(false);
        if (initialPrompt?.trim()) {
          setInputDisabled(true);
          setMessages(m => [...m, { role: 'user', content: initialPrompt.trim() }]);
          const msg = {
            channel: 'cli' as const,
            senderId: 'user',
            chatId: 'direct',
            content: initialPrompt.trim(),
            timestamp: new Date(),
          };
          const out = await runtime.agent.process(msg);
          if (cancelled) return;
          if (out) setMessages(m => [...m, { role: 'assistant', content: out.content }]);
        }
        setInputDisabled(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSend = async (content: string) => {
    if (!runtimeRef.current) return;
    setMessages(m => [...m, { role: 'user', content }]);
    setInputDisabled(true);
    const msg = {
      channel: 'cli' as const,
      senderId: 'user',
      chatId: 'direct',
      content,
      timestamp: new Date(),
    };
    try {
      const out = await runtimeRef.current.agent.process(msg);
      if (out) setMessages(m => [...m, { role: 'assistant', content: out.content }]);
    } finally {
      setInputDisabled(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <Layout title="Chat">
        <text fg={theme.textMuted}>Loading config and agent...</text>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout title="Chat">
        <text fg={theme.error}>{error}</text>
      </Layout>
    );
  }

  return (
    <Layout
      title="Chat"
      footer={
        <text fg={theme.textMuted}>
          {inputDisabled ? 'Thinking...' : 'Click Send to send · Or Tab to focus Send then Enter'}
        </text>
      }
    >
      <box flexDirection="column" flexGrow={1} height="100%">
        <ChatMessages messages={messages} />
        <box paddingTop={1}>
          <ChatInput onSubmit={handleSend} disabled={inputDisabled} />
        </box>
      </box>
    </Layout>
  );
}
