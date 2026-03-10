/**
 * Gateway 聊天页状态与总线订阅
 * 集中管理消息列表、历史加载、出站/流式订阅与发送逻辑
 */

import { useState, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MessageItem } from '../components/MessageList';
import { getSessionKey, type OutboundMessage } from '@nanobot/shared';
import { SlashCommandExecutor, createAllHandlers } from '../commands';
import { buildSlashCommandContext } from './slashCommandContext';
import { sessionToMessageItems } from './sessionUtils';
import type { Runtime } from '@nanobot/main';
import type { Config } from '@nanobot/shared';
import type { ViewMode } from '../context';
import type { DialogContextValue } from '../components/Dialog';
import type { ChatInputHandle } from '../components/ChatInput';

export interface UseGatewayChatParams {
  runtime: Runtime | null;
  config: Config | null;
  configLoaded: boolean;
  pendingPrompt: string | null | undefined;
  clearPendingPrompt: () => void;
  navigateTo: (view: ViewMode) => void;
  dialog: DialogContextValue;
  chatInputRef: React.RefObject<ChatInputHandle | null>;
}

export interface UseGatewayChatResult {
  messages: MessageItem[];
  setMessages: Dispatch<SetStateAction<MessageItem[]>>;
  status: 'idle' | 'responding';
  inputDisabled: boolean;
  handleSend: (content: string) => Promise<void>;
  handleSlashCommand: (commandId: string) => Promise<void>;
  slashCommands: Array<{ id: string; label: string; description: string }>;
  loading: boolean;
  error: string | null;
}

export function useGatewayChat(params: UseGatewayChatParams): UseGatewayChatResult {
  const {
    runtime,
    config,
    configLoaded,
    pendingPrompt,
    clearPendingPrompt,
    navigateTo,
    dialog,
    chatInputRef,
  } = params;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'responding'>('idle');

  const streaming = config?.agents.defaults.streaming ?? true;
  const defaultModel = config?.agents.defaults.model ?? '';

  const slashExecutor = useMemo(() => {
    const executor = new SlashCommandExecutor();
    executor.registerAll(createAllHandlers());
    return executor;
  }, []);

  const slashCommands = useMemo(() => slashExecutor.getSlashCommandOptions(), [slashExecutor]);

  // 从 session 加载历史消息（仅加载一次）
  useEffect(() => {
    if (!runtime || historyLoaded) return;

    const loadHistory = async () => {
      const sessionKey = getSessionKey({ channel: 'cli', chatId: 'direct' });
      const session = await runtime.sessions.getOrCreate(sessionKey);
      setMessages(sessionToMessageItems(session));
      setHistoryLoaded(true);
    };

    void loadHistory();
  }, [runtime, historyLoaded]);

  // 统一订阅：stream-text 仅流式时累积；outbound 时按模式区分：流式更新最后一条，非流式直接追加
  useEffect(() => {
    if (!runtime) return;

    const streamTextHandler = (event: { channel: string; chatId: string; chunk: string }) => {
      if (event.channel !== 'cli' || !streaming) return;

      setMessages(m => {
        const last = m[m.length - 1];
        if (last?.role !== 'assistant' || last.isStreaming === false) {
          return [
            ...m,
            {
              role: 'assistant',
              content: event.chunk,
              isStreaming: true,
              timestamp: new Date().toISOString(),
            },
          ];
        }
        const next = [...m];
        const lastIdx = next.length - 1;
        const item = next[lastIdx];
        if (item) {
          next[lastIdx] = {
            ...item,
            role: 'assistant',
            content: (item.content ?? '') + event.chunk,
            isStreaming: true,
            model: defaultModel,
            timestamp: item.timestamp ?? '',
          };
        }
        return next;
      });
    };

    const toolHintHandler = (_event: { channel: string; chatId: string; content: string }) => {
      // 预留：在对应消息下方显示工具提示
    };

    const outboundHandler = (msg: OutboundMessage) => {
      if (msg.channel !== 'cli') return;

      const isApproval = msg.metadata?.approvalId != null;

      if (isApproval) {
        // 审核确认消息：仅追加展示，不恢复 idle，继续等待用户确认
        setMessages(m => [
          ...m,
          {
            role: 'assistant',
            content: msg.content,
            model: defaultModel,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      // Agent 回复：恢复可输入并结束本轮
      setStatus('idle');
      setInputDisabled(false);
      setMessages(m => {
        if (streaming) {
          const last = m[m.length - 1];
          if (last?.role === 'assistant' && last.isStreaming) {
            const next = [...m];
            next[next.length - 1] = { ...last, isStreaming: false };
            return next;
          }
          return m;
        }
        return [
          ...m,
          {
            role: 'assistant',
            content: msg.content,
            model: defaultModel,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    };

    runtime.bus.on('stream-text', streamTextHandler);
    runtime.bus.on('tool-hint', toolHintHandler);
    runtime.bus.on('outbound', outboundHandler);

    return () => {
      runtime.bus.off('stream-text', streamTextHandler);
      runtime.bus.off('tool-hint', toolHintHandler);
      runtime.bus.off('outbound', outboundHandler);
    };
  }, [runtime, streaming, defaultModel]);

  // pendingPrompt：历史加载完成后发一条入站并清空 pending
  useEffect(() => {
    if (!runtime || !pendingPrompt?.trim() || !historyLoaded) return;

    const sendPendingMessage = async () => {
      setInputDisabled(true);
      setStatus('responding');
      setMessages(m => [...m, { role: 'user', content: pendingPrompt.trim() }]);

      await runtime.bus.publishInbound({
        channel: 'cli',
        senderId: 'user',
        chatId: 'direct',
        content: pendingPrompt.trim(),
        timestamp: new Date(),
      });

      clearPendingPrompt();
    };

    void sendPendingMessage();
  }, [runtime, pendingPrompt, clearPendingPrompt, historyLoaded]);

  const handleSend = async (content: string) => {
    if (!runtime) return;

    const skillRegex = /^\/([a-zA-Z0-9_-]+)\s+(.*)$/;
    const match = content.match(skillRegex);

    let processedContent = content;
    if (match) {
      const skillName = match[1];
      const userMessage = match[2];
      if (skillName) {
        const skill = runtime.skills.getSkill(skillName);

        if (skill) {
          processedContent = `## Skill: ${skill.name}\n\n${skill.content}\n\n---\n\n${userMessage}`;
        }
      }
    }

    setStatus('responding');
    setMessages(m => [...m, { role: 'user', content: processedContent }]);
    setInputDisabled(true);
    await runtime.bus.publishInbound({
      channel: 'cli',
      senderId: 'user',
      chatId: 'direct',
      content: processedContent,
      timestamp: new Date(),
    });
  };

  const handleSlashCommand = async (commandId: string) => {
    const context = buildSlashCommandContext({
      runtime,
      config,
      navigateTo,
      setMessages,
      dialog,
      defaultModel,
      chatInputRef,
    });
    const executed = await slashExecutor.execute(commandId, context);
    if (!executed) {
      navigateTo('home');
    }
  };

  const loading = !configLoaded;
  const error = configLoaded && !config ? 'No config found. Run "nanobot init" first.' : null;

  return {
    messages,
    setMessages,
    status,
    inputDisabled,
    handleSend,
    handleSlashCommand,
    slashCommands,
    loading,
    error,
  };
}
