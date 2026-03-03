import { useEffect } from 'react';
import { useKeyboard } from '@opentui/react';
import { AppProvider, useAppContext } from './context';
import { HomeView } from './home';
import { GatewayApp } from './gateway';
import { StatusApp } from './status';
import { ConfigApp } from './config';
import { SetupWizard, CheckError } from './setup';
import { CommandPalette } from './components/CommandPalette';
import { DialogProvider } from './components/Dialog';
import { theme } from './theme';
import { useWindowTitle } from './hooks';
import type { TuiOptions } from './index';
import type { CliRenderer } from '@opentui/core';

export type ViewMode = 'home' | 'gateway' | 'status' | 'config' | 'setup' | 'check-error';

interface MainAppProps {
  mode: ViewMode;
  options?: TuiOptions | undefined;
  renderer: CliRenderer | null;
}

function MainAppContent({ options }: Omit<MainAppProps, 'renderer'>) {
  const {
    currentView,
    commandPaletteOpen,
    navigateTo,
    setCommandPaletteOpen,
    selfCheckResult,
    reloadConfig,
  } = useAppContext();

  // 根据当前视图动态设置终端标题
  useWindowTitle(
    currentView === 'home' ? 'Nanobot-ts' :
      currentView === 'gateway' ? 'Nanobot - Gateway' :
        currentView === 'status' ? 'Nanobot - Status' :
          currentView === 'config' ? 'Nanobot - Config' :
            currentView === 'setup' ? 'Nanobot - Setup' :
              currentView === 'check-error' ? 'Nanobot - Error' :
                'Nanobot CLI'
  );

  useKeyboard(key => {
    if (key.ctrl && key.name === 'p') {
      setCommandPaletteOpen(true);
      return;
    }

    if (
      key.name === 'escape' &&
      currentView !== 'home' &&
      currentView !== 'setup' &&
      currentView !== 'check-error'
    ) {
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
        <CommandPalette
          onClose={() => setCommandPaletteOpen(false)}
          onSelect={handleCommandSelect}
        />
      )}
      <box flexGrow={1}>
        {currentView === 'home' && <HomeView />}
        {currentView === 'gateway' && <GatewayApp />}
        {currentView === 'status' && <StatusApp />}
        {currentView === 'config' && (
          <ConfigApp keyOption={options?.key} valueOption={options?.value} />
        )}
        {currentView === 'setup' && <SetupWizard />}
        {currentView === 'check-error' && selfCheckResult && (
          <CheckError
            result={selfCheckResult}
            onRetry={reloadConfig}
            onSetup={() => navigateTo('setup')}
          />
        )}
      </box>
    </box>
  );
}

interface AppWrapperProps {
  mode: ViewMode;
  options?: TuiOptions | undefined;
  renderer: CliRenderer | null;
}

function AppWrapper({ mode, options, renderer }: AppWrapperProps) {
  const { setRenderer } = useAppContext();

  // 设置 renderer 到 context
  useEffect(() => {
    if (renderer) {
      setRenderer(renderer);
    }
  }, [renderer, setRenderer]);

  return <MainAppContent mode={mode} options={options} />;
}

export function App({ mode, options, renderer }: MainAppProps) {
  const initialView = mode === 'home' ? 'home' : mode;

  return (
    <AppProvider initialView={initialView}>
      <DialogProvider>
        <AppWrapper mode={mode} options={options} renderer={renderer} />
      </DialogProvider>
    </AppProvider>
  );
}
