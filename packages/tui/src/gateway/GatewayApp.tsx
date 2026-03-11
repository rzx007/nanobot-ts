import { useAppContext } from '../context';
import { useDialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput, type ChatInputHandle } from '../components/ChatInput';
import { theme } from '../theme';
import { useGatewayChat } from './useGatewayChat';
import { useRef } from 'react';
// import { SubagentPanel } from '../subagent/SubagentPanel';
export function GatewayApp() {
  const { configLoaded, config, runtime, pendingPrompt, clearPendingPrompt, navigateTo } =
    useAppContext();
  const dialog = useDialog();
  const chatInputRef = useRef<ChatInputHandle | null>(null);

  const {
    messages,
    status,
    inputDisabled,
    handleSend,
    handleSlashCommand,
    slashCommands,
    loading,
    error,
  } = useGatewayChat({
    runtime,
    config,
    configLoaded,
    pendingPrompt,
    clearPendingPrompt,
    navigateTo,
    dialog,
    chatInputRef,
  });


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
        {/* <SubagentPanel runtime={runtime} /> */}
        <box paddingTop={1} flexShrink={0} width="100%">
          <ChatInput
            ref={chatInputRef}
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
