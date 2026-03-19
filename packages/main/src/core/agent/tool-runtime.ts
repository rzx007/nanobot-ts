import type { ToolSet } from '@nanobot/shared';
import type { ToolRegistry } from '../../tools/registry';

export interface ToolRuntimeDeps {
  tools: ToolRegistry;
  maxChars: number;
}

export class ToolRuntime {
  constructor(private readonly deps: ToolRuntimeDeps) {}

  applyChatContext(channel: string, chatId: string): void {
    for (const name of this.deps.tools.getToolNames()) {
      const t = this.deps.tools.get(name);
      if (
        t &&
        'setContext' in t &&
        typeof (t as { setContext?: (ch: string, cid: string) => void }).setContext === 'function'
      ) {
        (t as { setContext: (ch: string, cid: string) => void }).setContext(channel, chatId);
      }
    }
  }

  getDefinitions(): ToolSet {
    return this.deps.tools.getDefinitions();
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: { channel: string; chatId: string },
  ): Promise<string> {
    let result = await this.deps.tools.execute(name, args, context);
    if (result.length > this.deps.maxChars) {
      result = result.slice(0, this.deps.maxChars) + '\n... (truncated)';
    }
    return `Tool "${name}" returned:\n${result}`;
  }
}
