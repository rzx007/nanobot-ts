import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Config } from '@/config/schema';

export type ViewMode = 'home' | 'chat' | 'status' | 'config';

export interface AppContextValue {
  currentView: ViewMode;
  commandPaletteOpen: boolean;
  sessionKey: string | null;
  config: Config | null;
  navigateTo: (view: ViewMode) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSessionKey: (key: string | null) => void;
  setConfig: (config: Config | null) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
  initialView?: ViewMode;
}

export function AppProvider({ children, initialView = 'home' }: AppProviderProps) {
  const [currentView, setCurrentView] = useState<ViewMode>(initialView);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  const navigateTo = useCallback((view: ViewMode) => {
    setCurrentView(view);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentView,
        commandPaletteOpen,
        sessionKey,
        config,
        navigateTo,
        setCommandPaletteOpen,
        setSessionKey,
        setConfig,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
