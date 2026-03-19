/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import type { ToolUIPart } from "ai"
import type { QuestionEvent, ApprovalEvent, StreamPartPayload, StreamFinishEvent } from "@nanobot/shared"

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
import type { AttachmentData } from "@/components/ai-elements/attachments"
import {
  sendMessage,
  getChatHistory,
  clearChatHistory,
} from "@/services"
import { QuestionDialog } from "@/components/question-dialog"
import { ApprovalDialog } from "@/components/approval-dialog"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
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
} from "@/components/ai-elements/message"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources"
import { SpeechInput } from "@/components/ai-elements/speech-input"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { CheckIcon, GlobeIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
export const Route = createFileRoute("/chat")({
  component: ChatPage,
})

interface MessageType {
  key: string
  from: "user" | "assistant"
  sources?: { href: string; title: string }[]
  versions: {
    id: string
    content: string
  }[]
  reasoning?: {
    content: string
    duration: number
  }
  tools?: {
    name: string
    description?: string
    status: ToolUIPart["state"]
    parameters?: Record<string, unknown>
    result: string | undefined
    error: string | undefined
  }[]
}

const models = [
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o",
    name: "GPT-4o",
    providers: ["openai", "azure"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai",
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providers: ["openai", "azure"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-opus-4-20250514",
    name: "Claude 4 Opus",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    chef: "Google",
    chefSlug: "google",
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    providers: ["google"],
  },
]

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
  "What is the difference between SQL and NoSQL?",
  "Explain cloud computing basics",
]

const chefs = ["OpenAI", "Anthropic", "Google"]

function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: AttachmentData
  onRemove: (id: string) => void
}) {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id)
  }, [onRemove, attachment.id])

  return (
    <Attachment data={attachment} onRemove={handleRemove}>
      <AttachmentPreview />
      <AttachmentRemove />
    </Attachment>
  )
}

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments()

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id)
    },
    [attachments]
  )

  if (attachments.files.length === 0) {
    return null
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.id}
          onRemove={handleRemove}
        />
      ))}
    </Attachments>
  )
}

function SuggestionItem({
  suggestion,
  onClick,
}: {
  suggestion: string
  onClick: (suggestion: string) => void
}) {
  const handleClick = useCallback(() => {
    onClick(suggestion)
  }, [onClick, suggestion])

  return <Suggestion onClick={handleClick} suggestion={suggestion} />
}

function ModelItem({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0]
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const handleSelect = useCallback(() => {
    onSelect(m.id)
  }, [onSelect, m.id])

  return (
    <ModelSelectorItem onSelect={handleSelect} value={m.id}>
      <ModelSelectorLogo provider={m.chefSlug} />
      <ModelSelectorName>{m.name}</ModelSelectorName>
      <ModelSelectorLogoGroup>
        {m.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
      {isSelected ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  )
}

function ChatPage() {
  const [model, setModel] = useState<string>(models[0].id)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [text, setText] = useState<string>("")
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready")
  const [messages, setMessages] = useState<MessageType[]>([])
  const [chatId] = useState<string>(() => {
    const stored = localStorage.getItem("nanobot-chat-id")
    if (stored) return stored
    const newId = nanoid()
    localStorage.setItem("nanobot-chat-id", newId)
    return newId
  })
  const [questionEvent, setQuestionEvent] = useState<QuestionEvent | null>(null)
  const [approvalEvent, setApprovalEvent] = useState<ApprovalEvent | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  )

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      setHistoryLoading(true)
      try {
        const history = await getChatHistory(chatId)
        if (cancelled) return
        const historyMessages: MessageType[] = history
          .filter((item) => item.role === "user" || item.role === "assistant")
          .map((item) => ({
            from: item.role,
            key: `${item.role}-${nanoid()}`,
            versions: [{ id: nanoid(), content: item.content }],
          }))
        setMessages(historyMessages)
      } catch (error) {
        console.error("Failed to load chat history:", error)
        toast.error("加载聊天历史失败")
      } finally {
        if (!cancelled) setHistoryLoading(false)
      }
    }
    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [chatId])

  const updateMessageContent = useCallback(
    (messageId: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.versions.some((v) => v.id === messageId)) {
            return {
              ...msg,
              versions: msg.versions.map((v) =>
                v.id === messageId ? { ...v, content: newContent } : v
              ),
            }
          }
          return msg
        })
      )
    },
    []
  )

  const updateMessageByKey = useCallback(
    (messageKey: string, updater: (message: MessageType) => MessageType) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.key === messageKey ? updater(msg) : msg))
      )
    },
    []
  )

  const addUserMessage = useCallback(
    async (content: string) => {
      const userMessage: MessageType = {
        from: "user",
        key: `user-${Date.now()}`,
        versions: [
          {
            content,
            id: `user-${Date.now()}`,
          },
        ],
      }

      setMessages((prev) => [...prev, userMessage])

      const assistantMessageKey = `assistant-${Date.now()}`
      const assistantMessageId = `${assistantMessageKey}-v1`
      const assistantMessage: MessageType = {
        from: "assistant",
        key: assistantMessageKey,
        versions: [
          {
            content: "",
            id: assistantMessageId,
          },
        ],
      }

      setMessages((prev) => [...prev, assistantMessage])

      setIsStreaming(true)
      let fullContent = ""

      try {
        await sendMessage(content, chatId, {
          onPart: (part: StreamPartPayload) => {
            if (part.type === "text-delta") {
              fullContent += part.text
              updateMessageContent(assistantMessageId, fullContent)
              return
            }
            if (part.type === "reasoning-start") {
              updateMessageByKey(assistantMessageKey, (msg) => ({
                ...msg,
                reasoning: { content: "", duration: 0 },
              }))
              return
            }
            if (part.type === "reasoning-delta") {
              updateMessageByKey(assistantMessageKey, (msg) => ({
                ...msg,
                reasoning: {
                  content: `${msg.reasoning?.content ?? ""}${part.text}`,
                  duration: msg.reasoning?.duration ?? 0,
                },
              }))
              return
            }
            if (part.type === "tool-input-start") {
              updateMessageByKey(assistantMessageKey, (msg) => ({
                ...msg,
                tools: [
                  ...(msg.tools ?? []),
                  {
                    name: part.toolName,
                    description: `工具 ${part.toolName} 执行中`,
                    status: "input-available",
                    parameters: {},
                    result: undefined,
                    error: undefined,
                  },
                ],
              }))
              return
            }
            if (part.type === "tool-result") {
              updateMessageByKey(assistantMessageKey, (msg) => ({
                ...msg,
                tools: (msg.tools ?? []).map((tool) =>
                  tool.name === part.toolName
                    ? {
                      ...tool,
                      status: "output-available",
                      result: String(("output" in part ? part.output : "") ?? ""),
                    }
                    : tool
                ),
              }))
              return
            }
            if (part.type === "tool-error") {
              updateMessageByKey(assistantMessageKey, (msg) => ({
                ...msg,
                tools: (msg.tools ?? []).map((tool) =>
                  tool.name === part.toolName
                    ? {
                      ...tool,
                      status: "output-error",
                      error: String(("error" in part ? part.error : "") ?? ""),
                    }
                    : tool
                ),
              }))
              return
            }
            if (part.type === "error") {
              updateMessageContent(
                assistantMessageId,
                fullContent + "\n\n[错误: 流处理失败]"
              )
              setIsStreaming(false)
              setStatus("error")
              return
            }
            if (part.type === "abort") {
              setIsStreaming(false)
              setStatus("ready")
            }
          },
          onFinish: (event: StreamFinishEvent) => {
            if (event.part?.assistantContent) {
              fullContent = event.part.assistantContent
              // updateMessageContent(assistantMessageId, fullContent)
            }
          },
          onDone: () => {
            setIsStreaming(false)
            setStatus("ready")
          },
          onQuestion: (event) => {
            setQuestionEvent(event)
          },
          onApproval: (event) => {
            setApprovalEvent(event)
          },
          onError: (error) => {
            console.error("Message stream error:", error)
            updateMessageContent(
              assistantMessageId,
              fullContent + "\n\n[错误: 连接中断]"
            )
            setIsStreaming(false)
            setStatus("error")
          },
        })
      } catch (error) {
        console.error("Failed to send message:", error)
        updateMessageContent(
          assistantMessageId,
          fullContent + "\n\n[错误: 发送失败]"
        )
        setIsStreaming(false)
        setStatus("error")
      }
    },
    [chatId, updateMessageContent, updateMessageByKey]
  )

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text)
      const hasAttachments = Boolean(message.files?.length)

      if (!(hasText || hasAttachments)) {
        return
      }

      if (isStreaming) {
        return
      }

      setStatus("submitted")

      if (message.files?.length) {
        toast.success("Files attached", {
          description: `${message.files.length} file(s) attached to message`,
        })
      }

      addUserMessage(message.text || "Sent with attachments")
      setText("")
    },
    [addUserMessage, isStreaming]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setStatus("submitted")
      addUserMessage(suggestion)
    },
    [addUserMessage]
  )

  const handleTranscriptionChange = useCallback((transcript: string) => {
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
  }, [])

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(event.target.value)
    },
    []
  )

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev)
  }, [])

  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId)
    setModelSelectorOpen(false)
  }, [])

  const handleClearHistory = useCallback(async () => {
    try {
      await clearChatHistory(chatId)
      setMessages([])
      toast.success("已清空会话历史")
    } catch (error) {
      console.error("Failed to clear chat history:", error)
      toast.error("清空会话历史失败")
    }
  }, [chatId])

  const isSubmitDisabled = useMemo(
    () => !text.trim() || isStreaming,
    [text, isStreaming]
  )

  return (
    <div className="relative flex h-full flex-col divide-y">
      <Conversation className="h-full flex-1 overflow-hidden">
        <ConversationContent className="h-full overflow-auto">
          {historyLoading && messages.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground">加载历史消息中...</div>
          )}
          {messages.map(({ versions, ...message }) => (
            <MessageBranch defaultBranch={0} key={message.key}>
              <MessageBranchContent>
                {versions.map((version) => (
                  <Message
                    from={message.from}
                    key={`${message.key}-${version.id}`}
                  >
                    <div>
                      {message.sources?.length && (
                        <Sources>
                          <SourcesTrigger count={message.sources.length} />
                          <SourcesContent>
                            {message.sources.map((source) => (
                              <Source
                                href={source.href}
                                key={source.href}
                                title={source.title}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {message.reasoning && (
                        <Reasoning duration={message.reasoning.duration}>
                          <ReasoningTrigger />
                          <ReasoningContent>
                            {message.reasoning.content}
                          </ReasoningContent>
                        </Reasoning>
                      )}
                      <MessageContent>
                        <MessageResponse>{version.content}</MessageResponse>
                      </MessageContent>
                      {message.tools && message.tools.length > 0 && (
                        <div className="mt-2 space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
                          {message.tools.map((tool, index) => (
                            <div className="space-y-1" key={`${tool.name}-${index}`}>
                              <div className="font-medium">
                                工具: {tool.name} ({tool.status})
                              </div>
                              {tool.result && (
                                <div className="text-muted-foreground whitespace-pre-wrap">
                                  结果: {tool.result}
                                </div>
                              )}
                              {tool.error && (
                                <div className="text-red-500 whitespace-pre-wrap">
                                  错误: {tool.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Message>
                ))}
              </MessageBranchContent>
              {versions.length > 1 && (
                <MessageBranchSelector>
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
              )}
            </MessageBranch>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="grid shrink-0 gap-4 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((suggestion) => (
            <SuggestionItem
              key={suggestion}
              onClick={handleSuggestionClick}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
        <div className="w-full px-4 pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">会话ID: {chatId}</div>
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={handleClearHistory}
              type="button"
            >
              清空历史
            </button>
          </div>
          {questionEvent && (
            <QuestionDialog
              questionEvent={questionEvent}
              onClose={() => setQuestionEvent(null)}
            />
          )}
          {approvalEvent && (
            <ApprovalDialog
              approvalEvent={approvalEvent}
              onClose={() => setApprovalEvent(null)}
            />
          )}
          <PromptInput globalDrop multiple onSubmit={handleSubmit}>
            <PromptInputHeader>
              <PromptInputAttachmentsDisplay />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea onChange={handleTextChange} value={text} />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <SpeechInput
                  className="shrink-0"
                  onTranscriptionChange={handleTranscriptionChange}
                  size="icon-sm"
                  variant="ghost"
                />
                <PromptInputButton
                  onClick={toggleWebSearch}
                  variant={useWebSearch ? "default" : "ghost"}
                >
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <ModelSelector
                  onOpenChange={setModelSelectorOpen}
                  open={modelSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton>
                      {selectedModelData?.chefSlug && (
                        <ModelSelectorLogo
                          provider={selectedModelData.chefSlug}
                        />
                      )}
                      {selectedModelData?.name && (
                        <ModelSelectorName>
                          {selectedModelData.name}
                        </ModelSelectorName>
                      )}
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {chefs.map((chef) => (
                        <ModelSelectorGroup heading={chef} key={chef}>
                          {models
                            .filter((m) => m.chef === chef)
                            .map((m) => (
                              <ModelItem
                                isSelected={model === m.id}
                                key={m.id}
                                m={m}
                                onSelect={handleModelSelect}
                              />
                            ))}
                        </ModelSelectorGroup>
                      ))}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
              </PromptInputTools>
              <PromptInputSubmit disabled={isSubmitDisabled} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}
