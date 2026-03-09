import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import type { Config } from '@/config/schema';
import { loadConfig } from '@/config/loader';
import { ChannelManager, CLIChannel } from '@/channels';
import { buildAgentRuntime, type AgentRuntime } from '@/cli/setup';
import { logger } from '@/utils';
import { initializeWorkspace } from '@/cli/lib/init';
import { useSelfCheck } from '../hooks';
import type { SelfCheckResult } from '../setup/types';
import type { CliRenderer } from '@opentui/core';

export type ViewMode = 'home' | 'gateway' | 'status' | 'config' | 'setup' | 'check-error';

export interface AppContextValue {
  currentView: ViewMode;
  commandPaletteOpen: boolean;
  sessionKey: string | null;
  config: Config | null;
  /** 是否已完成首次配置加载（含「无配置」情况） */
  configLoaded: boolean;
  /** 由 AppContext 统一 build 的 runtime，无配置时为 null */
  runtime: AgentRuntime | null;
  /** 自检结果 */
  selfCheckResult: SelfCheckResult | null;
  /** opentui renderer 实例，用于设置终端标题等 */
  renderer: CliRenderer | null;
  /** 待发送到 gateway 的 prompt */
  pendingPrompt: string | null;
  navigateTo: (view: ViewMode, prompt?: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSessionKey: (key: string | null) => void;
  setConfig: (config: Config | null) => void;
  /** 从磁盘重新加载配置，供自检/CheckError 使用 */
  reloadConfig: () => Promise<void>;
  /** 设置 renderer 实例 */
  setRenderer: (renderer: CliRenderer | null) => void;
  /** 清除 pending prompt */
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
  const [runtime, setRuntime] = useState<AgentRuntime | null>(null);
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

  // 使用自检hook
  const { result: selfCheckResult } = useSelfCheck(config);

  const reloadConfig = useCallback(async () => {
    try {
      const loaded = await loadConfig();
      setConfig(loaded);
      if (!loaded) return;
      const rt = await buildAgentRuntime(loaded);
      setRuntime(rt);
      const { bus, agent, config: cfg } = rt;
      const channelManager = new ChannelManager(cfg, bus);
      channelManager.registerChannel('cli', new CLIChannel({}, bus));
      await channelManager.loadChannelsFromConfig(bus);
      await channelManager.startAll();
      channelManager.runOutboundLoop();
      agent.run().catch(err => {
        logger.error({ err }, 'Agent loop error');
      });
      setConfig(cfg);
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
          const tuiLogger = {
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

        const rt = await buildAgentRuntime(loaded);
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
