import { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { ChatInput } from '../chat';
import { Layout } from '../components/Layout';
import { loadConfig } from '@/config/loader';
import { theme } from '../theme';

interface HomeViewProps {
  initialPrompt?: string | undefined;
}

export function HomeView({ initialPrompt }: HomeViewProps) {
  const { navigateTo } = useAppContext();
  const [currentModel, setCurrentModel] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const config = await loadConfig();
      if (config) {
        setCurrentModel(config.agents.defaults.model);
      }
      setLoading(false);
      if (initialPrompt?.trim()) {
        navigateTo('chat');
      }
    })();
  }, [initialPrompt, navigateTo]);

  const handleSubmit = () => {
    navigateTo('chat');
  };

  if (loading) {
    return (
      <Layout title="">
        <text fg={theme.textMuted}>Loading...</text>
      </Layout>
    );
  }

  return (
    <Layout
      title=""
      footer={
        <text fg={theme.textMuted}>
          Press <span fg={theme.accent}>Ctrl+P</span> for command palette · Press{' '}
          <span fg={theme.accent}>Enter</span> to send
        </text>
      }
    >
      <box
        flexDirection="column"
        flexGrow={1}
        height="100%"
        justifyContent="center"
        alignItems="center"
      >
        <box flexDirection="column" alignItems="center" marginBottom={2}>
          <text fg={theme.accent}> __ __ _ _ ___ ___ ___ _ _ ___ ___ </text>
          <text fg={theme.accent}> | \/ || || || __|| _ \| _ \ | || || __|| __|</text>
          <text fg={theme.accent}> | |\/| || __ || _| | /| /| __ || _| | _| </text>
          <text fg={theme.accent}> |_| |_||_||_||___||_|_\|_|_\||_||_||___||___|</text>
        </box>

        <box marginTop={1} marginBottom={1}>
          <text fg={theme.textMuted}>
            Model:{' '}
            <span fg={theme.text}>
              <strong>{currentModel || 'Not configured'}</strong>
            </span>
          </text>
        </box>

        <box width="80%" marginTop={2}>
          <ChatInput onSubmit={handleSubmit} placeholder="Start a new conversation..." />
        </box>
      </box>
    </Layout>
  );
}
