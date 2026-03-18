/**
 * Runtime 创建模块
 * 统一的初始化逻辑，返回完整的运行时对象
 */

import path from 'path';
import type { Config, InboundMessage, QuestionEvent, ApprovalEvent } from '@nanobot/shared';
import { expandHome } from '@nanobot/utils';
import { logger } from '@nanobot/logger';
import { MessageBus } from './bus';
import { SessionManager } from './storage';
import { MemoryConsolidator } from './core/memory';
import { AgentLoop } from './core/agent';
import { ApprovalManager } from './approval';
import { SubagentManager } from './core/subagent';
import { SkillLoader } from './skills/skills';
import { ToolRegistry } from './tools/registry';
import { QuestionTool } from './tools/question';
import { CronTool } from './tools/cronTool';
import { CLIChannel } from '@nanobot/channels';
import { CLIApprovalHandler, MessageApprovalHandler } from './approval';
import { QuestionManager } from './question';
import { CLIQuestionHandler } from './question';
import { MCPToolLoader } from './mcp/loader';
import { LLMProvider } from '@nanobot/providers';
import { ChannelManager } from '@nanobot/channels';
import { CronService } from './cron';
import { BrowserOpenTool, BrowserCloseTool, BrowserSnapshotTool, BrowserClickTool, BrowserFillTool, BrowserTypeTool, BrowserScreenshotTool, BrowserWaitTool, BrowserGetTool, BrowserEvalTool, BrowserPressTool, BrowserSelectTool, BrowserCheckTool, BrowserUncheckTool, BrowserScrollTool, BrowserBackTool, BrowserForwardTool, BrowserReloadTool, BrowserPdfTool } from './tools/browser';
import { ReadFileTool, WriteFileTool, CreateFileTool, EditFileTool, DeleteFileTool, ListDirTool } from './tools/filesystem';
import { HotNewsTool } from './tools/hotnews';
import { MessageTool } from './tools/message';
import { ExecTool } from './tools/shell';
import { LoadSkillTool, MatchSkillTool } from './tools/skill';
import { SubagentTool } from './tools/subagent';
import { WebSearchTool, WebFetchTool } from './tools/web';

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

  // agent
  agent: AgentLoop;

  // 工具
  approvalManager: ApprovalManager;
  questionManager: QuestionManager;
  subagentManager: SubagentManager | null;
  cronService: CronService;

  // 渠道
  channelManager: ChannelManager;

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
    public questionManager: QuestionManager,
    public subagentManager: SubagentManager | null,
    public cronService: CronService,
    public channelManager: ChannelManager,
  ) { }

  private get agentLoop(): AgentLoop {
    if (!this._agentLoop) {
      this._agentLoop = new AgentLoop({
        bus: this.bus,
        provider: this.provider,
        tools: this.tools,
        sessions: this.sessions,
        config: this.config,
        memory: this.memory,
        skills: this.skills,
      });
    }
    return this._agentLoop;
  }

  public get agent(): AgentLoop {
    return this.agentLoop;
  }
  async start(options?: { startChannels?: boolean }): Promise<void> {
    if (this.isRunning) {
      logger.warn('Runtime is already running');
      return;
    }

    logger.info(
      `Starting runtime in ${this.config?.agents?.defaults?.workspace || 'default'} mode...`,
    );

    const { startChannels = true } = options ?? {};

    // 启动 agent
    await this.agentLoop.run();
    logger.info('🤖 Agent started');

    // 启动 channels
    if (startChannels) {
      await this.startChannelsLoop();
      this.isChannelsRunning = true;
      logger.info('🧭 Channels started');
    }

    this.isRunning = true;
    logger.info('🤖 Runtime started successfully');
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

    /**
     * 启动出站循环
     */
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
 * - Channel Manager
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
  const approvalManager = new ApprovalManager(config, bus);
  tools.setApprovalCheck(approvalManager);

  // 6. 消息过滤器（检查是否是确认回复）
  bus.addInboundFilter(m => {
    // 检查是否是确认回复（通过 metadata.approvalRequestID）
    if (m.metadata?.approvalRequestID) {
      const trimmed = m.content.trim().toLowerCase();
      const approved = trimmed === 'yes' || trimmed === 'y' || trimmed === '是' || trimmed === '确认';

      approvalManager.respond(m.metadata.approvalRequestID as string, approved);
      return true; // 拦截，不继续处理
    }

    return false;
  });

  // 8. Subagent Manager
  let subagentManager: SubagentManager | null = null;
  if (config.subagent?.enabled) {
    const { SubagentManager } = await import('./core/subagent');
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

  // 11. Question Manager
  const questionManager = new QuestionManager(bus);
  // 12. Question Tool
  const questionTool = new QuestionTool(questionManager);
  tools.register(questionTool);

  // 13. 浏览器工具
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

  // 14. MCP 工具
  const mcpLoader = new MCPToolLoader();
  await mcpLoader.load(config, tools);

  // 15. Cron 服务
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



  // 16. Memory Consolidator
  const memory = new MemoryConsolidator(config);

  // 17. Skills Loader
  const skills = new SkillLoader(config);
  await skills.init();

  // 18. 技能工具
  const loadSkillTool = new LoadSkillTool();
  const matchSkillTool = new MatchSkillTool();
  loadSkillTool.setSkillLoader(skills);
  matchSkillTool.setSkillLoader(skills);
  tools.register(loadSkillTool);
  tools.register(matchSkillTool);

  // 19. Channel Manager
  const channelManager = new ChannelManager(config);
  channelManager.registerChannel('cli', new CLIChannel({}));
  await channelManager.loadChannelsFromConfig();

  await channelManager.startAll({
    onInbound: (msg: InboundMessage) => void bus.publishInbound(msg),
  });

  // 20. 创建 Runtime 对象
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
    questionManager,
    subagentManager,
    cronService,
    channelManager,
  );

  // 21. 注册 approval 事件监听器

  // CLI 渠道监听器（仅在 gateway 模式且非 TUI 时使用）
  if (mode === 'gateway') {
    const cliApprovalHandler = new CLIApprovalHandler(approvalManager);

    bus.on('approval', (event: ApprovalEvent) => {
      // 只处理非 TUI 场景（TUI 由自己的 useGatewayChat 处理）
      if (event.channel === 'cli' && event.type === 'approval.asked') {
        void cliApprovalHandler.handleApproval(event);
      }
    });
  }

  // 三方渠道监听器（WhatsApp、Feishu、Email）
  const messageApprovalHandler = new MessageApprovalHandler(bus, approvalManager);

  bus.on('approval', (event: ApprovalEvent) => {
    if (
      ['whatsapp', 'feishu', 'email'].includes(event.channel) &&
      event.type === 'approval.asked'
    ) {
      messageApprovalHandler.handleApproval(event);
    }
  });

  // 22. 问题事件监听（仅 CLI 渠道）
  if (mode === 'gateway') {
    const cliQuestionHandler = new CLIQuestionHandler(questionManager);
    bus.on('question', (event: QuestionEvent) => {
      if (
        event.type === 'question.asked' &&
        event.channel === 'cli' &&
        mode === 'gateway'
      ) {
        void cliQuestionHandler.handleQuestions(event.requestID, event.questions);
      }
    });
  }

  logger.info('Runtime created successfully');

  return runtime;
}
