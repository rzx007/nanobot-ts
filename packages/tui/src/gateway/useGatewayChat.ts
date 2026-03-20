/**
 * Gateway 聊天页状态与总线订阅
 * 集中管理消息列表、历史加载、出站/流式订阅与发送逻辑
 */

import { useState, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MessageItem } from '../components/MessageList';
import { getSessionKey } from '@nanobot/shared';
import { SlashCommandExecutor, createAllHandlers } from '../commands';
import { taskCancellation } from '@nanobot/main';
import { buildSlashCommandContext } from './slashCommandContext';
import { sessionToMessageItems } from './sessionUtils';
import type { Runtime } from '@nanobot/main';
import type { Config, QuestionEvent, ApprovalEvent } from '@nanobot/shared';
import type { ViewMode } from '../context';
import type { DialogContextValue } from '../components/Dialog';
import type { ChatInputHandle } from '../components/ChatInput';
import { useKeyboard } from '@opentui/react';

type OutboundMessage = { channel: string; chatId: string; content: string };
type StreamPartEvent = { channel: string; chatId: string; part: any };

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
  /** 取消当前对话的处理函数（UI 快捷键调用） */
  handleCancel?: () => void;
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
  const [pendingApprovalRequestID, setPendingApprovalRequestID] = useState<string | null>(null);

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
      const sessionKey = getSessionKey({
        channel: 'cli',
        chatId: 'direct',
        sessionKeyOverride: undefined,
      });
      const session = await runtime.sessions.getOrCreate(sessionKey);
      setMessages(sessionToMessageItems(session));
      setHistoryLoaded(true);
    };

    void loadHistory();
  }, [runtime, historyLoaded]);

  // 统一订阅：处理完整的流事件
  useEffect(() => {
    if (!runtime) return;

    const streamPartHandler = (event: StreamPartEvent) => {
      if (event.channel !== 'cli' || !streaming) return;

      const part = event.part;

      setMessages(m => {
        const last = m[m.length - 1];
        if (!last || last.role !== 'assistant') return m;

        const next = [...m];
        const lastIdx = next.length - 1;
        const prevItem = next[lastIdx];
        if (!prevItem) return m;

        const item: MessageItem = {
          role: prevItem.role,
          content: prevItem.content ?? '',
          isStreaming: prevItem.isStreaming ?? false,
          model: prevItem.model,
          timestamp: prevItem.timestamp,
          toolHints: prevItem.toolHints,
          reasoning: prevItem.reasoning,
          toolCalls: prevItem.toolCalls ?? [],
          steps: prevItem.steps ?? [],
        };

        switch (part.type) {
          case 'text-delta':
            item.content = (item.content ?? '') + part.text;
            break;
          case 'reasoning-start':
            item.reasoning = { content: '', duration: 0 };
            break;
          case 'reasoning-delta':
            if (item.reasoning) {
              item.reasoning.content += part.text;
            }
            break;
          case 'tool-input-start':
            if (!item.toolCalls) item.toolCalls = [];
            item.toolCalls.push({
              name: part.toolName,
              status: 'running',
            });
            break;
          case 'tool-result':
            const tool = item.toolCalls?.find(t => t.name === part.toolName);
            if (tool) {
              tool.status = part.isError ? 'error' : 'success';
              tool.result = part.result;
            }
            break;
          case 'tool-error':
            const errTool = item.toolCalls?.find(t => t.name === part.toolName);
            if (errTool) {
              errTool.status = 'error';
              errTool.error = part.error;
            }
            break;
          case 'finish':
            item.isStreaming = false;
            if (typeof part.assistantContent === 'string' && part.assistantContent.length > 0) {
              item.content = part.assistantContent;
            }
            setStatus('idle');
            setInputDisabled(false);
            break;
          case 'error':
            item.isStreaming = false;
            setStatus('idle');
            setInputDisabled(false);
            break;
          case 'abort':
            item.isStreaming = false;
            setStatus('idle');
            setInputDisabled(false);
            break;
        }

        next[lastIdx] = item;
        return next;
      });
    };

    const questionHandler = (event: QuestionEvent) => {
      if (event.channel !== 'cli') return;
      setMessages(m => [...m, { role: 'assistant', content: event.questions.map(q => q.question).join('\n'), timestamp: new Date().toISOString() }]);
    };

    const approvalHandler = (event: ApprovalEvent) => {
      if (event.channel !== 'cli' || event.type !== 'approval.asked') return;

      const paramsDisplay = Object.entries(event.params)
        .map(([key, value]) => {
          const valueStr = JSON.stringify(value);
          const truncated = valueStr.length > 50 ? `${valueStr.slice(0, 50)}...` : valueStr;
          return `${key}=${truncated}`;
        })
        .join(', ');

      const message = (
        `⚠️ 工具执行需要确认\n` +
        `工具: ${event.toolName}\n` +
        `参数: ${paramsDisplay}\n` +
        `超时: ${event.timeout}秒\n\n` +
        `回复 "yes" 确认，"no" 取消`
      );

      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: message,
          model: defaultModel,
          timestamp: new Date().toISOString(),
          metadata: { approvalRequestID: event.requestID },
        },
      ]);

      setPendingApprovalRequestID(event.requestID);
    };

    const outboundHandler = (msg: OutboundMessage) => {
      if (msg.channel !== 'cli') return;

      // Agent 回复：恢复可输入并结束本轮，清除 pending approval
      setStatus('idle');
      setInputDisabled(false);
      setPendingApprovalRequestID(null);

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

    runtime.bus.on('stream-part', streamPartHandler);
    runtime.bus.on('question', questionHandler);
    runtime.bus.on('approval', approvalHandler);
    runtime.bus.on('outbound', outboundHandler);

    return () => {
      runtime.bus.off('stream-part', streamPartHandler);
      runtime.bus.off('question', questionHandler);
      runtime.bus.off('approval', approvalHandler);
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
      metadata: pendingApprovalRequestID ? { approvalRequestID: pendingApprovalRequestID } : {},
    });
    setPendingApprovalRequestID(null);
  };

  const handleCancel = async () => {
    const currentSessionKey = getSessionKey({
      channel: 'cli',
      chatId: 'direct',
      sessionKeyOverride: undefined,
    });
    taskCancellation.cancelCurrentTask(currentSessionKey, 'user');

    const allTaskStatuses = runtime?.subagentManager?.getAllTaskStatuses();
    if (allTaskStatuses) {
      for (const [taskId, taskStatus] of allTaskStatuses) {
        if (taskStatus === 'running' || taskStatus === 'pending') {
          try {
            await runtime?.subagentManager?.cancel(taskId);
          } catch (error) {
            console.error(`Failed to cancel subagent task ${taskId}:`, error);
          }
        }
      }
    }
    setInputDisabled(false);
    setMessages(m => [
      ...m,
      {
        role: 'system',
        content: '对话已取消（UI 提示）',
        timestamp: new Date().toISOString(),
      },
    ]);
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


  useKeyboard((k) => {
    if (k.name === 'escape') {
      handleCancel?.();
      setStatus('idle')
    }
  });


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
    handleCancel,
  };
}
