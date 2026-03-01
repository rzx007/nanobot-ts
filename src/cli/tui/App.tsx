import { useKeyboard } from '@opentui/react';
import { AppProvider, useAppContext } from './context';
import { HomeView } from './home';
import { GatewayApp } from './gateway';
import { StatusApp } from './status';
import { ConfigApp } from './config';
import { CommandPalette } from './components/CommandPalette';
import { DialogProvider } from './components/Dialog';
import { theme } from './theme';
import type { TuiOptions } from './index';

export type ViewMode = 'home' | 'gateway' | 'status' | 'config';

interface MainAppProps {
  mode: ViewMode;
  options?: TuiOptions | undefined;
}

function MainAppContent({ options }: MainAppProps) {
  const { currentView, commandPaletteOpen, navigateTo, setCommandPaletteOpen } = useAppContext();

  useKeyboard(key => {
    if (key.ctrl && key.name === 'p') {
      setCommandPaletteOpen(true);
      return;
    }

    if (key.name === 'escape' && currentView !== 'home') {
      navigateTo('home');
      return;
    }
  });

  const handleCommandSelect = (commandId: string) => {
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
        navigateTo('home');
        break;
    }
  };

  return (
    <box flexDirection="column" width="100%" height="100%" backgroundColor={theme.bg}>
      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} onSelect={handleCommandSelect} />
      )}
      <box flexGrow={1}>
        {currentView === 'home' && <HomeView initialPrompt={options?.prompt} />}
        {currentView === 'gateway' && (
          <GatewayApp prompt={options?.prompt} interactive={options?.interactive ?? false} />
        )}
        {currentView === 'status' && <StatusApp />}
        {currentView === 'config' && (
          <ConfigApp keyOption={options?.key} valueOption={options?.value} />
        )}
      </box>
    </box>
  );
}

export function App({ mode, options }: MainAppProps) {
  const initialView = mode === 'home' ? 'home' : mode;

  return (
    <AppProvider initialView={initialView}>
      <DialogProvider>
        <MainAppContent mode={mode} options={options} />
      </DialogProvider>
    </AppProvider>
  );
}
