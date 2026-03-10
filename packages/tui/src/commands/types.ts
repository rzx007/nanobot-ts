import type { MessageItem } from '../components/MessageList';
import type { ViewMode } from '../context';
import type { Config } from '@nanobot/shared';
import type { Runtime } from '@nanobot/main';
import type { ReactNode } from 'react';
import type { ChatInputHandle } from '../components/ChatInput';

/**
 * Slash 命令分类
 */
export type SlashCommandCategory = 'chat' | 'navigation' | 'system';

/**
 * Slash 命令执行上下文
 * 提供给命令处理器使用，包含执行命令所需的所有上下文信息
 */
export interface SlashCommandContext {
  /** Agent 运行时实例 */
  runtime: Runtime | null;

  /** 配置对象 */
  config: Config | null;

  /** 导航到指定视图 */
  navigateTo: (view: ViewMode) => void;

  /** 设置消息列表 */
  setMessages: React.Dispatch<React.SetStateAction<MessageItem[]>>;

  /** 清空消息列表 */
  clearMessages: () => void;

  /** 添加系统消息到列表 */
  addSystemMessage: (content: string) => void;

  /** 添加用户消息到列表 */
  addUserMessage: (content: string) => void;

  /** 添加助手消息到列表 */
  addAssistantMessage: (content: string) => void;

  /** 打开 Dialog */
  openDialog: (element: ReactNode, onClose?: () => void) => void;

  /** 关闭所有 Dialogs */
  closeDialog: () => void;

  /** ChatInput 引用，用于插入文本 */
  chatInputRef: React.RefObject<ChatInputHandle | null> | null;
}

/**
 * Slash 命令处理器接口
 * 每个命令都实现此接口，Handler 是命令的唯一数据源
 */
export interface SlashCommandHandler {
  /** 命令 ID，用于内部标识 */
  id: string;

  /** 命令标签，显示在命令列表中（如 "/new"） */
  label: string;

  /** 命令描述，显示在命令列表中 */
  description: string;

  /** 命令分类（可选） */
  category?: SlashCommandCategory;

  /**
   * 执行命令
   * @param context 命令执行上下文
   */
  execute(context: SlashCommandContext): Promise<void> | void;
}

/**
 * 从 Handler 数组生成 SlashCommandOption 数组
 * 用于 ChatInput 的命令选择器
 */
export function handlersToSlashCommands(handlers: SlashCommandHandler[]): Array<{
  id: string;
  label: string;
  description: string;
}> {
  return handlers.map(h => ({
    id: h.id,
    label: h.label,
    description: h.description,
  }));
}
