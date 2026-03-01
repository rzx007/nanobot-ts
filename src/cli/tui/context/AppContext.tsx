import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { Config } from '@/config/schema';
import { loadConfig } from '@/config/loader';
import { ChannelManager, CLIChannel } from '@/channels';
import { buildAgentRuntime, type AgentRuntime } from '@/cli/setup';
import { logger } from '@/utils';

export type ViewMode = 'home' | 'gateway' | 'status' | 'config';

export interface AppContextValue {
  currentView: ViewMode;
  commandPaletteOpen: boolean;
  sessionKey: string | null;
  config: Config | null;
  /** 是否已完成首次配置加载（含「无配置」情况） */
  configLoaded: boolean;
  /** 由 AppContext 统一 build 的 runtime，无配置时为 null */
  runtime: AgentRuntime | null;
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
  const [configLoaded, setConfigLoaded] = useState(false);
  const [runtime, setRuntime] = useState<AgentRuntime | null>(null);

  const navigateTo = useCallback((view: ViewMode) => {
    setCurrentView(view);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadConfig();
        if (cancelled) return;
        if (!loaded) {
          setConfig(null);
          setConfigLoaded(true);
          // TODO: 无配置时初始化引导（先不实现）
          return;
        }

        const rt = await buildAgentRuntime(loaded, true);
        if (cancelled) return;
        setRuntime(rt);
        const { bus, agent, config: cfg } = rt;
        const channelManager = new ChannelManager(cfg, bus);
        // 注册 CLIChannel 用于本地交互
        channelManager.registerChannel('cli', new CLIChannel({}, bus));
        // 从配置加载其他渠道
        await channelManager.loadChannelsFromConfig(bus);
        // 启动所有渠道
        await channelManager.startAll();
        // 启动出站循环
        channelManager.runOutboundLoop();

        agent.run().catch(err => {
          logger.error({ err }, 'Agent loop error');
        });
        setConfig(cfg);
      } catch (err) {
        if (cancelled) return;
        logger.error({ err }, 'Agent runtime init error');
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentView,
        commandPaletteOpen,
        sessionKey,
        config,
        configLoaded,
        runtime,
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
