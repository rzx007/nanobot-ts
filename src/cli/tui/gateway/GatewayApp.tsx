import { useState, useEffect } from 'react';
import type { MessageItem } from '../components/MessageList';
import { useAppContext } from '../context';
import { Layout } from '../components/Layout';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { theme } from '../theme';

export function GatewayApp({
  prompt: initialPrompt,
}: {
  prompt?: string | undefined;
  interactive?: boolean | undefined;
}) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const { navigateTo, configLoaded, config, runtime } = useAppContext();

  const [status, setStatus] = useState<'idle' | 'responding'>('idle');
  const loading = !configLoaded;
  const error = configLoaded && !config ? 'No config found. Run "nanobot init" first.' : null;

  const handleSlashCommand = (commandId: string) => {
    switch (commandId) {
      case 'new':
        navigateTo('home');
        break;
      case 'status':
        navigateTo('status');
        break;
      case 'models':
      case 'themes':
        navigateTo('config');
        break;
      case 'sessions':
        navigateTo('status');
        break;
      default:
        break;
    }
  };

  // 订阅出站消息，将 cli 渠道的回复追加到消息列表
  useEffect(() => {
    if (!runtime) return;
    const handler = (msg: { channel: string; chatId: string; content: string }) => {
      if (msg.channel !== 'cli') return;
      setMessages(m => [...m, { role: 'assistant', content: msg.content }]);
      setInputDisabled(false);
      setStatus('idle');
    };
    runtime.bus.on('outbound', handler);
   
    return () => {
      runtime.bus.off('outbound', handler);
    };
  }, [runtime]);

  // 有 initialPrompt 时发一条入站消息（新会话）
  useEffect(() => {
    if (!runtime || !initialPrompt?.trim()) return;
    setInputDisabled(true);
    setMessages(m => [...m, { role: 'user', content: initialPrompt.trim() }]);
    void runtime.bus.publishInbound({
      channel: 'cli',
      senderId: 'user',
      chatId: 'direct',
      content: initialPrompt.trim(),
      timestamp: new Date(),
    });
  }, [runtime, initialPrompt]);

  const handleSend = async (content: string) => {
    if (!runtime) return;
    setStatus('responding');
    setMessages(m => [...m, { role: 'user', content }]);
    setInputDisabled(true);
    await runtime.bus.publishInbound({
      channel: 'cli',
      senderId: 'user',
      chatId: 'direct',
      content,
      timestamp: new Date(),
    });
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
    >
      <box flexDirection="column" flexGrow={1} height="100%" width="100%">
        <box flexGrow={1} minHeight={0} width="100%" overflow="hidden" flexDirection="column">
          <ChatMessages messages={messages} />
        </box>
        <box paddingTop={1} flexShrink={0} width="100%">
          <ChatInput
          status={status}
          onSubmit={handleSend}
          disabled={inputDisabled}
          onSlashCommand={handleSlashCommand}
        />
        </box>
      </box>
    </Layout>
  );
}
