import { useKeyboard, useRenderer } from '@opentui/react';
import { AppProvider, useAppContext } from './context';
import { HomeView } from './home';
import { ChatApp } from './chat';
import { StatusApp } from './status';
import { ConfigApp } from './config';
import { CommandPalette } from './components/CommandPalette';
import { theme } from './theme';
import type { TuiOptions } from './index';

export type ViewMode = 'home' | 'chat' | 'status' | 'config';

interface MainAppProps {
  mode: ViewMode;
  options?: TuiOptions | undefined;
}

function MainAppContent({ options }: MainAppProps) {
  const { currentView, commandPaletteOpen, navigateTo, setCommandPaletteOpen } = useAppContext();
  const renderer = useRenderer();

  useKeyboard(key => {
    if (commandPaletteOpen) {
      if (key.name === 'escape') {
        setCommandPaletteOpen(false);
      }
      return;
    }

    if (key.ctrl && key.name === 'p') {
      setCommandPaletteOpen(true);
      return;
    }

    if (key.name === 'escape' && currentView !== 'home') {
      navigateTo('home');
      return;
    }
  });

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.bg}>
      {commandPaletteOpen && (
        <CommandPalette
          onClose={() => setCommandPaletteOpen(false)}
          onSelect={(commandId: string) => {
            setCommandPaletteOpen(false);
            switch (commandId) {
              case 'new-chat':
                navigateTo('home');
                break;
              case 'view-status':
                navigateTo('status');
                break;
              case 'view-config':
                navigateTo('config');
                break;
              case 'exit':
                renderer.destroy();
                break;
            }
          }}
        />
      )}
      <box flexGrow={1} flexDirection="column">
        {currentView === 'home' && <HomeView initialPrompt={options?.prompt} />}
        {currentView === 'chat' && (
          <ChatApp prompt={options?.prompt} interactive={options?.interactive ?? false} />
        )}
        {currentView === 'status' && <StatusApp />}
        {currentView === 'config' && (
          <ConfigApp keyOption={options?.key} valueOption={options?.value} />
        )}
      </box>
    </box>
  );
}

export function MainApp({ mode, options }: MainAppProps) {
  const initialView = mode === 'home' ? 'home' : mode;

  return (
    <AppProvider initialView={initialView}>
      <MainAppContent mode={mode} options={options} />
    </AppProvider>
  );
}
