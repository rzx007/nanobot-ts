import { useState, useEffect } from 'react';
import { useAppContext } from '../context';
import { ChatInput } from '../chat';
import { Layout } from '../components/Layout';
import { Logo } from '../components/Logo';
import { theme } from '../theme';

const VERSION = '0.1.0';

const TIPS = [
  'Press Ctrl+P to open the command palette',
  'Press Enter to send and start a chat',
  'Use /status to view agent and gateway status',
  'Use /config to set API key and model',
];

function getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

interface HomeViewProps {
  initialPrompt?: string | undefined;
}

export function HomeView({ initialPrompt }: HomeViewProps) {
  const { navigateTo } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [tip] = useState(() => getRandomTip());

  useEffect(() => {
    (async () => {
      setLoading(false);
      if (initialPrompt?.trim()) {
        navigateTo('chat');
      }
    })();
  }, [initialPrompt, navigateTo]);

  const handleSubmit = () => {
    navigateTo('chat');
  };
  

  const handleSlashCommand = (commandId: string) => {
    switch (commandId) {
      case 'new':
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

  if (loading) {
    return (
      <Layout title="">
        <box flexGrow={1} justifyContent="center" alignItems="center">
          <text fg={theme.textMuted}>Loading...</text>
        </box>
      </Layout>
    );
  }

  return (
    <Layout
      title=""
      footer={
        <box flexDirection="row" width="100%" justifyContent="space-between" alignItems="center" padding={1}>
          <box flexDirection="row" gap={2}>
            <text fg={theme.textMuted}>~</text>
          </box>
          <text fg={theme.textMuted}>{VERSION}</text>
        </box>
      }
    >
      <box
        flexDirection="column"
        flexGrow={1}
        height="100%"
        alignItems="center"
        paddingLeft={2}
        paddingRight={2}
      >
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <box flexShrink={0}>
          <Logo />
        </box>
        <box height={1} minHeight={0} flexShrink={0} />
        <box width="100%" maxWidth={75} flexShrink={0} paddingTop={1}>
          <ChatInput
            onSubmit={handleSubmit}
            placeholder="Ask anything... e.g. 'What is the tech stack of this project?'"
            onSlashCommand={handleSlashCommand}
          />
        </box>
        <box
          height={4}
          minHeight={0}
          width="100%"
          maxWidth={75}
          alignItems="center"
          paddingTop={3}
          flexShrink={0}
        >
          <box flexDirection="row" maxWidth="100%">
            <text flexShrink={0} fg={theme.warn}>
              ● Tip{' '}
            </text>
            <text flexShrink={1} fg={theme.textMuted}>
              {tip}
            </text>
          </box>
        </box>
        <box flexGrow={1} minHeight={0} />
      </box>
    </Layout>
  );
}
