import { useState, useEffect, useMemo, type ReactNode } from 'react';
import type { MessageItem } from '../components/MessageList';
import { useAppContext } from '../context';
import { Layout } from '../components/Layout';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { useDialog } from '../components/Dialog';
import { theme } from '../theme';
import { getSessionKey } from '@/bus/types';
import { SlashCommandContext, SlashCommandExecutor, createAllHandlers } from '../commands';

export function GatewayApp() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { navigateTo, configLoaded, config, runtime, pendingPrompt, clearPendingPrompt } = useAppContext();
  const dialog = useDialog();

  // 创建 Slash 命令执行器
  const slashExecutor = useMemo(() => {
    const executor = new SlashCommandExecutor();
    executor.registerAll(createAllHandlers());
    return executor;
  }, []);

  // 获取命令列表（从 Handler 元数据生成）
  const slashCommands = useMemo(() =>
    slashExecutor.getSlashCommandOptions(),
    [slashExecutor]
  );

  const [status, setStatus] = useState<'idle' | 'responding'>('idle');
  const loading = !configLoaded;
  const error = configLoaded && !config ? 'No config found. Run "nanobot init" first.' : null;

  const handleSlashCommand = async (commandId: string) => {
    // 构建命令执行上下文
    const context: SlashCommandContext = {
      runtime,
      config,
      navigateTo,
      setMessages,
      clearMessages: () => setMessages([]),
      addSystemMessage: (content: string) => {
        setMessages(m => [...m, {
          role: 'assistant',
          content,
          model: '',
          timestamp: new Date().toISOString()
        }]);
      },
      addUserMessage: (content: string) => {
        setMessages(m => [...m, {
          role: 'user',
          content,
          model: '',
          timestamp: new Date().toISOString()
        }]);
      },
      addAssistantMessage: (content: string) => {
        setMessages(m => [...m, {
          role: 'assistant',
          content,
          model: config?.agents.defaults.model ?? '',
          timestamp: new Date().toISOString()
        }]);
      },
      openDialog: (element: ReactNode, onClose?: () => void) => {
        dialog.replace(element, onClose);
      },
      closeDialog: () => {
        dialog.clear();
      },
    };

    // 执行命令
    const executed = await slashExecutor.execute(commandId, context);

    // 如果命令未注册，返回 home（保持原有行为）
    if (!executed) {
      navigateTo('home');
    }
  };

  // 从 session 加载历史消息（仅加载一次）
  useEffect(() => {
    if (!runtime || historyLoaded) return;

    const loadHistory = async () => {
      const sessionKey = getSessionKey({
        channel: 'cli',
        chatId: 'direct',
      });
      const session = await runtime.sessions.getOrCreate(sessionKey);
      // 将 SessionMessage[] 转换为 MessageItem[]
      const historyMessages: MessageItem[] = session.messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          model: msg.model ?? '',
          timestamp: msg.timestamp ?? '',
        }));
      setMessages(historyMessages);
      setHistoryLoaded(true);
    };

    loadHistory();
  }, [runtime, historyLoaded]);

  // 订阅出站消息，将 cli 渠道的回复追加到消息列表
  useEffect(() => {
    if (!runtime) return;
    const handler = (msg: { channel: string; chatId: string; content: string }) => {
      if (msg.channel !== 'cli') return;
      setMessages(m => [...m, { role: 'assistant', content: msg.content, model: config?.agents.defaults.model ?? '', timestamp: new Date().toISOString() }]);
      setInputDisabled(false);
      setStatus('idle');
    };
    runtime.bus.on('outbound', handler);

    return () => {
      runtime.bus.off('outbound', handler);
    };
  }, [runtime]);

  // 有 pendingPrompt 时发一条入站消息（等待历史消息加载完成）
  useEffect(() => {
    if (!runtime || !pendingPrompt?.trim() || !historyLoaded) return;

    const sendPendingMessage = async () => {
      setInputDisabled(true);
      setStatus('responding');

      // 直接将 pendingPrompt 添加到当前消息列表（历史消息已由 loadHistory 加载）
      setMessages(m => [...m, { role: 'user', content: pendingPrompt.trim() }]);

      // 发送消息
      await runtime.bus.publishInbound({
        channel: 'cli',
        senderId: 'user',
        chatId: 'direct',
        content: pendingPrompt.trim(),
        timestamp: new Date(),
      });

      // 清除 pendingPrompt
      clearPendingPrompt();
    };

    sendPendingMessage();
  }, [runtime, pendingPrompt, clearPendingPrompt, historyLoaded]);

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
    <Layout title="">
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
            slashCommands={slashCommands}
          />
        </box>
      </box>
    </Layout>
  );
}
