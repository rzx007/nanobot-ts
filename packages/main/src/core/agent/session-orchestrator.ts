import type { Config, InboundMessage } from '@nanobot/shared';
import { getSessionKey } from '@nanobot/shared';
import { ContextBuilder } from '../context';
import type { SessionManager } from '../../storage';
import type { SkillInfo } from '../../skills/skills';

type SkillLoaderLike = {
  getAlwaysSkills(): SkillInfo[];
  buildSkillsSummary(): string;
};

type MemoryConsolidatorLike = {
  readLongTerm(): Promise<string>;
  needsConsolidation(session: unknown): boolean;
  consolidate(session: unknown, force?: boolean): Promise<void>;
};

export interface SessionOrchestratorDeps {
  config: Config;
  sessions: SessionManager;
  memoryWindow: number;
  memory: MemoryConsolidatorLike | null;
  skills: SkillLoaderLike | null;
}

export class SessionOrchestrator {
  constructor(private readonly deps: SessionOrchestratorDeps) {}

  getSessionKey(msg: Pick<InboundMessage, 'channel' | 'chatId' | 'sessionKeyOverride'>): string {
    return getSessionKey(msg);
  }

  async appendUserMessage(sessionKey: string, content: string): Promise<void> {
    await this.deps.sessions.addMessage(sessionKey, {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  async appendAssistantMessage(sessionKey: string, content: string): Promise<void> {
    if (!content) return;
    await this.deps.sessions.addMessage(sessionKey, {
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      model: this.deps.config.agents.defaults.model,
    } as any);
  }

  async buildPromptMessages(channel: string, chatId: string, content: string, sessionKey: string) {
    const history = await this.deps.sessions.getHistory(sessionKey, this.deps.memoryWindow);
    const memoryContext = this.deps.memory ? await this.deps.memory.readLongTerm() : '';

    const buildOpts: import('../context').BuildSystemPromptOptions = {
      workspace: this.deps.config.agents.defaults.workspace,
      alwaysSkills: this.deps.skills?.getAlwaysSkills() ?? [],
    };
    if (this.deps.skills) {
      const summary = this.deps.skills.buildSkillsSummary();
      if (summary) buildOpts.skillsSummary = summary;
    }
    if (memoryContext) buildOpts.memoryContext = memoryContext;

    const systemPrompt = await ContextBuilder.buildSystemPrompt(buildOpts);

    return ContextBuilder.buildMessages({
      systemPrompt,
      history,
      currentMessage: content,
      channel,
      chatId,
    });
  }

  async maybeConsolidate(sessionKey: string): Promise<void> {
    if (!this.deps.memory) return;
    const session = await this.deps.sessions.getOrCreate(sessionKey);
    if (this.deps.memory.needsConsolidation(session)) {
      await this.deps.memory.consolidate(session);
      await this.deps.sessions.saveSession(session);
    }
  }
}
