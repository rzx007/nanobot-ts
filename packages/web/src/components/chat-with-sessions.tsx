/**
 * 带会话列表的聊天页面
 *
 * 左侧：会话列表侧边栏
 * 右侧：对话内容
 */

import * as React from 'react';
import { useSessions } from '@/hooks/use-sessions';
import { SessionList } from '@/components/session-list';
import { SessionStatusIndicator } from '@/components/session-status-indicator';
import { CurrentSessionInfo } from '@/components/current-session-info';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import { PromptInput, usePromptInputAttachments } from '@/components/ai-elements/prompt-input';
import { useChat } from '@/hooks/use-chat';
import { Sidebar, SidebarContent, SidebarHeader, SidebarSeparator } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function ChatWithSessionsPage() {
  const {
    sessions,
    selectSession,
    isLoading,
    selectedSession,
  } = useSessions({
    refreshInterval: 30000,
    enableSSE: true,
  });

  const {
    messages,
    sendMessage,
    status,
  } = useChat();

  // 处理会话选择
  const handleSessionSelect = React.useCallback((sessionKey: string) => {
    selectSession(sessionKey);
    // 切换会话时加载该会话的消息历史
    // 这里可以添加逻辑来加载特定会话的消息
  }, [selectSession]);

  // 当前会话的键（从 URL 参数获取）
  const [currentSessionKey, setCurrentSessionKey] = React.useState<string>('');
  const sessionKey = selectedSession?.key || currentSessionKey;

  return (
    <div className="flex h-screen bg-background">
      {/* 左侧：会话列表 */}
      <Sidebar defaultOpen={true}>
        <SidebarContent>
          <SidebarHeader>
            <h1 className="text-lg font-semibold">
              Chats
            </h1>
            <SessionStatusIndicator
              status="idle"
              size="sm"
              showText={false}
            />
          </SidebarHeader>
          <SidebarSeparator />
          
          <SessionList
            activeSessionKey={sessionKey}
            onSessionSelect={handleSessionSelect}
            showSearch={true}
          />
        </SidebarContent>
      </Sidebar>

      {/* 右侧：对话内容 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* 当前会话信息栏 */}
        {selectedSession && (
          <div className="flex items-center justify-between px-6 py-3 border-b">
            <CurrentSessionInfo
              session={selectedSession}
              isBusy={selectedSession.sessionStatuses?.[sessionKey]?.type === 'busy'}
              onSessionChange={handleSessionSelect}
              onAbort={(key) => {
                console.log('Abort session:', key);
              }}
            />
          </div>
        )}

        {/* 对话区域 */}
        <Conversation className="h-full overflow-hidden">
          <ConversationContent className="h-full overflow-auto px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Loading messages...</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="text-4xl mb-4">💬</div>
                  <div className="text-lg font-medium text-muted-foreground mb-2">
                    No messages yet
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedSession
                      ? 'Start typing your message below to begin the conversation'
                      : 'Select or create a session to start chatting'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => {
                  const isCronMessage = message?.metadata?.messageFrom === 'cron';

                  if (isCronMessage) {
                    return null; // Cron 消息单独显示
                  }

                  return (
                    <Message key={message.id} message={message} from={message.role}>
                      <MessageBranch>
                        <MessageBranchContent>
                          {message.role === 'assistant' ? (
                            <MessageResponse>
                              <MessageContent>
                                {message.parts?.map((part, index) => {
                                  if (part.type === 'text') {
                                    return (
                                      <div key={index}>
                                        {part.text}
                                      </div>
                                    )
                                  }
                                  return null
                                })}
                              </MessageContent>
                            </MessageResponse>
                          ) : (
                            <MessageContent>
                              {message.parts?.map((part, index) => {
                                if (part.type === 'text') {
                                  return (
                                    <div key={index}>
                                      {part.text}
                                    </div>
                                  )
                                }
                                return null
                              })}
                            </MessageContent>
                          )}
                        </MessageBranchContent>
                      </MessageBranch>
                      <MessageBranchNext />
                      <MessageBranchPage />
                      <MessageBranchPrevious />
                      <MessageBranchSelector />
                    </MessageBranch>
                    </Message>
                  );
                })}
              </>
            )}
          </ConversationContent>

          {/* 底部：输入区域 */}
          <div className="border-t p-4">
            <PromptInput
              onSubmit={async (message) => {
                // 发送消息到当前会话
                if (sessionKey) {
                  await sendMessage({
                    text: message.text || '',
                    files: message.files,
                  });
                }
              }}
              onCancel={() => {
                console.log('Prompt input cancelled');
              }}
              placeholder={`Type a message for ${selectedSession?.metadata?.name || selectedSession?.metadata?.title || 'this session'}...`}
            />
          </div>

          {/* 滚动到底部按钮 */}
          <ConversationScrollButton />
        </Conversation>
      </div>
    </div>
  );
}
