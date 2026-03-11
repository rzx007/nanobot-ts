/**
 * Runtime 创建模块
 * 统一的初始化逻辑，返回完整的运行时对象
 */

import path from 'path';
import { MessageBus } from '@/bus/queue';
import { ChannelManager, CLIChannel } from '@/channels';

import { CronService } from '@/cron';
import { MCPToolLoader } from '@/mcp';
import { LLMProvider } from '@/providers';
import { SkillLoader } from '@/skills';
import { SessionManager } from '@/storage';
import {
  ToolRegistry,
  ReadFileTool,
  WriteFileTool,
  CreateFileTool,
  EditFileTool,
  DeleteFileTool,
  ListDirTool,
  ExecTool,
  WebSearchTool,
  WebFetchTool,
  HotNewsTool,
  MessageTool,
  SubagentTool,
  BrowserOpenTool,
  BrowserCloseTool,
  BrowserSnapshotTool,
  BrowserClickTool,
  BrowserFillTool,
  BrowserTypeTool,
  BrowserScreenshotTool,
  BrowserWaitTool,
  BrowserGetTool,
  BrowserEvalTool,
  BrowserPressTool,
  BrowserSelectTool,
  BrowserCheckTool,
  BrowserUncheckTool,
  BrowserScrollTool,
  BrowserBackTool,
  BrowserForwardTool,
  BrowserReloadTool,
  BrowserPdfTool,
  CronTool,
  LoadSkillTool,
  MatchSkillTool,
} from '@/tools';
import { logger } from '@/utils/logger';
import { expandHome } from '@/utils/helpers';
import type { Config } from '@/config/schema';
import { AgentLoop } from './agent';
import { ApprovalManager } from './approval';
import { MemoryConsolidator } from './memory';
import { SubagentManager } from './subagent';
import { InboundMessage } from '@/bus';

/**
 * Runtime 运行时对象
 */
export interface Runtime {
  // 核心
  config: Config;
  workspace: string;
  bus: MessageBus;
  sessions: SessionManager;
  provider: LLMProvider;
  tools: ToolRegistry;
  memory: MemoryConsolidator;
  skills: SkillLoader;

  // 工具
  approvalManager: ApprovalManager;
  subagentManager: SubagentManager | null;
  cronService: CronService;

  // 渠道
  channelManager: ChannelManager;

  // Agent Loop
  agent: AgentLoop;

  // 运行时状态
  isRunning: boolean;
  isChannelsRunning: boolean;

  // 启动/停止方法
  start(options?: { startChannels?: boolean }): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Runtime 创建选项
 */
export interface CreateRuntimeOptions {
  config: Config;
  mode?: 'cli' | 'tui' | 'server' | 'gateway';
  startChannels?: boolean;
}

/**
 * Runtime 实现
 */
class RuntimeImpl implements Runtime {
  isRunning = false;
  isChannelsRunning = false;
  private outboundLoopRunning = false;
  private _agentLoop: AgentLoop | null = null;

  constructor(
    public config: Config,
    public workspace: string,
    public bus: MessageBus,
    public sessions: SessionManager,
    public provider: LLMProvider,
    public tools: ToolRegistry,
    public memory: MemoryConsolidator,
    public skills: SkillLoader,
    public approvalManager: ApprovalManager,
    public subagentManager: SubagentManager | null,
    public cronService: CronService,
    public channelManager: ChannelManager,
  ) { }

  private get agentLoop(): AgentLoop {
    this._agentLoop ??= new AgentLoop({
      bus: this.bus,
      provider: this.provider,
      tools: this.tools,
      sessions: this.sessions,
      config: this.config,
      memory: this.memory,
      skills: this.skills,
    });
    return this._agentLoop;
  }

  // 公共的 agentLoop 属性
  public get agent(): AgentLoop {
    return this.agentLoop;
  }

  async start(options?: { startChannels?: boolean }): Promise<void> {
    if (this.isRunning) {
      logger.warn('Runtime is already running');
      return;
    }

    logger.info(
      `Starting runtime in ${this.config?.agents?.defaults?.workspace ?? 'default'} mode...`,
    );

    const { startChannels = true } = options ?? {};

    // 启动 agent
    await this.agentLoop.run();
    logger.info('Agent started');

    // 启动 channels
    if (startChannels) {
      await this.startChannelsLoop();
      this.isChannelsRunning = true;
      logger.info('Channels started');
    }

    this.isRunning = true;
    logger.info('Runtime started successfully');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Runtime is not running');
      return;
    }

    logger.info('Stopping runtime...');

    // 停止 channels
    if (this.isChannelsRunning) {
      this.outboundLoopRunning = false;
      await this.channelManager.stop();
      this.isChannelsRunning = false;
      logger.info('Channels stopped');
    }

    // 停止 subagent manager
    if (this.subagentManager) {
      await this.subagentManager.shutdown();
      logger.info('Subagent manager stopped');
    }

    this.isRunning = false;
    logger.info('Runtime stopped');
  }

  private async startChannelsLoop(): Promise<void> {
    if (this.outboundLoopRunning) {
      return;
    }

    this.outboundLoopRunning = true;

    void (async () => {
      while (this.outboundLoopRunning) {
        try {
          const msg = await this.bus.consumeOutbound();
          await this.channelManager.dispatchOutbound(msg);
        } catch (err) {
          if (this.outboundLoopRunning) {
            logger.error({ err }, 'Outbound dispatch error');
          }
        }
      }
    })();
  }
}

/**
 * 创建 Runtime
 *
 * 统一的初始化方法，包括：
 * - Session Manager
 * - Message Bus
 * - Agent Loop
 * - Tools 注册（文件、Shell、Web、Browser、Cron、Skills、Subagent、MCP）
 * - Memory Consolidator
 * - Skills Loader
 * - Approval Manager
 * - Subagent Manager
 * - Cron Service
 * - Channel Manager（从分散代码中统一）
 */
export async function createRuntime(options: CreateRuntimeOptions): Promise<Runtime> {
  const { config, mode = 'gateway' } = options;

  logger.info(`Creating runtime for mode: ${mode}`);

  const workspace = expandHome(config.agents.defaults.workspace);

  // 1. Session Manager
  const sessions = new SessionManager(workspace);
  await sessions.init();

  // 2. Message Bus
  const bus = new MessageBus();

  // 3. LLM Provider
  const provider = new LLMProvider(config);

  // 4. Tool Registry
  const tools = new ToolRegistry();

  // 5. Approval Manager
  const approvalManager = new ApprovalManager(config);
  tools.setApprovalCheck(approvalManager);

  // 6. 初始化默认处理器
  approvalManager.initializeDefaultHandlers(bus);

  // 7. 消息过滤器
  bus.addInboundFilter(m => approvalManager.handleUserMessage(m.channel, m.chatId, m.content));

  // 8. Subagent Manager
  let subagentManager: SubagentManager | null = null;
  if (config.subagent?.enabled) {
    subagentManager = new SubagentManager({
      config,
      bus,
      provider,
      tools,
      workspace,
    });
    await subagentManager.initialize();
  }

  // 9. 注册基础工具
  tools.register(new ReadFileTool(config));
  tools.register(new WriteFileTool(config));
  tools.register(new CreateFileTool(config));
  tools.register(new EditFileTool(config));
  tools.register(new DeleteFileTool(config));
  tools.register(new ListDirTool(config));
  tools.register(new ExecTool(config));
  tools.register(new WebSearchTool(config));
  tools.register(new WebFetchTool());
  tools.register(new HotNewsTool());
  tools.register(new MessageTool(config, bus));

  // 10. Subagent 工具
  if (subagentManager) {
    const subagentTool = new SubagentTool();
    subagentTool.setManager(subagentManager);
    tools.register(subagentTool);
  }

  // 11. 浏览器工具
  if (config.tools.browser?.enabled) {
    tools.register(new BrowserOpenTool(config));
    tools.register(new BrowserCloseTool(config));
    tools.register(new BrowserSnapshotTool(config));
    tools.register(new BrowserClickTool(config));
    tools.register(new BrowserFillTool(config));
    tools.register(new BrowserTypeTool(config));
    tools.register(new BrowserScreenshotTool(config));
    tools.register(new BrowserWaitTool(config));
    tools.register(new BrowserGetTool(config));
    tools.register(new BrowserEvalTool(config));
    tools.register(new BrowserPressTool(config));
    tools.register(new BrowserSelectTool(config));
    tools.register(new BrowserCheckTool(config));
    tools.register(new BrowserUncheckTool(config));
    tools.register(new BrowserScrollTool(config));
    tools.register(new BrowserBackTool(config));
    tools.register(new BrowserForwardTool(config));
    tools.register(new BrowserReloadTool(config));
    tools.register(new BrowserPdfTool(config));
  }

  // 12. MCP 工具
  const mcpLoader = new MCPToolLoader();
  await mcpLoader.load(config, tools);

  // 13. Cron 服务
  const cronStorePath = path.join(workspace, 'cron.json');
  const cronService = new CronService({
    storePath: cronStorePath,
    onJob: async job => {
      const ch = job.payload.channel ?? 'cli';
      const to = job.payload.to ?? 'direct';
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const content = job.payload.message.replace(/\{\{time\}\}/g, timeStr);
      await bus.publishInbound({
        channel: ch,
        senderId: 'cron',
        chatId: to,
        content: `📢 ${content}`,
        timestamp: new Date(),
      });
      return null;
    },
  });
  await cronService.start();
  tools.register(new CronTool(cronService));

  // 14. Memory Consolidator
  const memory = new MemoryConsolidator(config);

  // 15. Skills Loader
  const skills = new SkillLoader(config);
  await skills.init();

  // 16. 技能工具
  const loadSkillTool = new LoadSkillTool();
  const matchSkillTool = new MatchSkillTool();
  loadSkillTool.setSkillLoader(skills);
  matchSkillTool.setSkillLoader(skills);
  tools.register(loadSkillTool);
  tools.register(matchSkillTool);

  // 17. Channel Manager
  const channelManager = new ChannelManager(config);
  channelManager.registerChannel('cli', new CLIChannel({}));
  await channelManager.loadChannelsFromConfig();

  await channelManager.startAll({
    onInbound: (msg: InboundMessage) => void bus.publishInbound(msg),
  });

  // 19. 创建 Runtime 对象
  const runtime = new RuntimeImpl(
    config,
    workspace,
    bus,
    sessions,
    provider,
    tools,
    memory,
    skills,
    approvalManager,
    subagentManager,
    cronService,
    channelManager,
  );

  logger.info('Runtime created successfully');

  return runtime;
}
