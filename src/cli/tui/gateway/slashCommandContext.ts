/**
 * 构建 Slash 命令执行上下文
 * 从 Gateway 的 state/setters 和依赖中组装 SlashCommandContext，便于维护与测试
 */

import type { ReactNode } from 'react';
import type { MessageItem } from '../components/MessageList';
import type { SlashCommandContext } from '../commands';
import type { Config } from '@/config/schema';
import type { AgentRuntime } from '@/cli/setup';
import type { ViewMode } from '../context';
import type { DialogContextValue } from '../components/Dialog';
import type { ChatInputHandle } from '../components/ChatInput';

export interface BuildSlashCommandContextParams {
  runtime: AgentRuntime | null;
  config: Config | null;
  navigateTo: (view: ViewMode) => void;
  setMessages: React.Dispatch<React.SetStateAction<MessageItem[]>>;
  dialog: DialogContextValue;
  defaultModel?: string;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
}

export function buildSlashCommandContext(
  params: BuildSlashCommandContextParams,
): SlashCommandContext {
  const {
    runtime,
    config,
    navigateTo,
    setMessages,
    dialog,
    defaultModel = '',
    chatInputRef,
  } = params;

  return {
    runtime,
    config,
    navigateTo,
    setMessages,
    clearMessages: () => setMessages([]),
    addSystemMessage: (content: string) => {
      setMessages(m => [
        ...m,
        { role: 'assistant', content, model: '', timestamp: new Date().toISOString() },
      ]);
    },
    addUserMessage: (content: string) => {
      setMessages(m => [
        ...m,
        { role: 'user', content, model: '', timestamp: new Date().toISOString() },
      ]);
    },
    addAssistantMessage: (content: string) => {
      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content,
          model: defaultModel,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    openDialog: (element: ReactNode, onClose?: () => void) => {
      dialog.replace(element, onClose);
    },
    closeDialog: () => {
      dialog.clear();
    },
    chatInputRef: chatInputRef ?? null,
  };
}
