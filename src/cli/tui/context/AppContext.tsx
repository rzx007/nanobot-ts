import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { Config } from '@/config/schema';
import { loadConfig } from '@/config/loader';
import { createRuntime, type Runtime, initializeWorkspace, type InitLogger } from '@/core';
import { logger } from '@/utils/logger';
import { useSelfCheck } from '../hooks';
import type { SelfCheckResult } from '../setup/types';
import type { CliRenderer } from '@opentui/core';
import { InboundMessage } from '@/bus';

export type ViewMode = 'home' | 'gateway' | 'status' | 'config' | 'setup' | 'check-error';

export interface AppContextValue {
  currentView: ViewMode;
  commandPaletteOpen: boolean;
  sessionKey: string | null;
  config: Config | null;
  configLoaded: boolean;
  runtime: Runtime | null;
  selfCheckResult: SelfCheckResult | null;
  renderer: CliRenderer | null;
  pendingPrompt: string | null;
  navigateTo: (view: ViewMode, prompt?: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSessionKey: (key: string | null) => void;
  setConfig: (config: Config | null) => void;
  reloadConfig: () => Promise<void>;
  setRenderer: (renderer: CliRenderer | null) => void;
  clearPendingPrompt: () => void;
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
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [renderer, setRendererState] = useState<CliRenderer | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const setRenderer = useCallback((renderer: CliRenderer | null) => {
    setRendererState(renderer);
  }, []);

  const navigateTo = useCallback((view: ViewMode, prompt?: string) => {
    setCurrentView(view);
    if (prompt) {
      setPendingPrompt(prompt);
    }
  }, []);

  const clearPendingPrompt = useCallback(() => {
    setPendingPrompt(null);
  }, []);

  const { result: selfCheckResult } = useSelfCheck(config);

  const reloadConfig = useCallback(async () => {
    try {
      const loaded = await loadConfig();
      setConfig(loaded);
      if (!loaded) return;
      const rt = await createRuntime({ config: loaded, mode: 'tui', startChannels: false });
      // const { bus, channelManager } = rt;

      // await channelManager.startAll({
      //   onInbound: (msg: InboundMessage) => void bus.publishInbound(msg),
      // });

      await rt.start({ startChannels: true });
      setConfig(loaded);
      setConfigLoaded(true);
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadConfig();
        if (cancelled) return;
        if (!loaded) {
          // 配置不存在，先执行文件系统初始化
          const tuiLogger: InitLogger = {
            info: (msg: string) => logger.info(msg),
            success: (msg: string) => logger.info(msg),
            error: (msg: string) => logger.error(msg),
          };
          await initializeWorkspace({ logger: tuiLogger });

          setConfig(null);
          setConfigLoaded(true);
          navigateTo('setup');
          return;
        }

        const rt = await createRuntime({ config: loaded, mode: 'tui', startChannels: false });
        if (cancelled) return;

        // 注册退出钩子：清空子代理队列
        const cleanupExit = async (): Promise<void> => {
          if (rt.subagentManager) {
            logger.info('TUI exit: clearing subagent queue');
            await rt.subagentManager.shutdown();
            logger.info('TUI exit: subagent queue cleared');
          }
        };

        // 监听进程退出信号
        process.on('exit', cleanupExit);
        process.on('SIGINT', cleanupExit);
        process.on('SIGTERM', cleanupExit);

        setRuntime(rt);
        // const { bus, channelManager } = rt;
        // await channelManager.startAll({
        //   onInbound: msg => void bus.publishInbound(msg),
        // });

        await rt.start({ startChannels: true });
        setConfig(loaded);
        setConfigLoaded(true);
      } catch (err) {
        if (cancelled) return;
        logger.error({ err }, 'Agent runtime init error');
        setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigateTo]);

  // 根据自检结果决定是否需要跳转
  useEffect(() => {
    if (!selfCheckResult || !configLoaded) {
      return;
    }

    if (!selfCheckResult.canProceed) {
      if (selfCheckResult.severity === 'error') {
        navigateTo('check-error');
      } else {
        navigateTo('setup');
      }
    }
  }, [selfCheckResult, configLoaded, navigateTo]);

  return (
    <AppContext.Provider
      value={{
        currentView,
        commandPaletteOpen,
        sessionKey,
        config,
        configLoaded,
        runtime,
        selfCheckResult,
        renderer,
        pendingPrompt,
        navigateTo,
        setCommandPaletteOpen,
        setSessionKey,
        setConfig,
        reloadConfig,
        setRenderer,
        clearPendingPrompt,
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
