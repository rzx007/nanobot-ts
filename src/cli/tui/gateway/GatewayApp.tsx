import { useAppContext } from '../context';
import { useDialog } from '../components/Dialog';
import { Layout } from '../components/Layout';
import { ChatMessages } from '../components/ChatMessages';
import { ChatInput } from '../components/ChatInput';
import { theme } from '../theme';
import { useGatewayChat } from './useGatewayChat';

export function GatewayApp() {
  const { configLoaded, config, runtime, pendingPrompt, clearPendingPrompt, navigateTo } =
    useAppContext();
  const dialog = useDialog();

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
