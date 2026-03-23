/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import { useChat } from "@/hooks/use-chat"
import { useCronEvents } from "@/hooks/use-cron-events"
import type { NanobotUIMessage, InferUIMessageData } from "@/types/ai-message"
import { clearChatHistory, getChatHistory } from "@/services/message-api"
import type { ToolUIPart } from "ai"

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
import type { AttachmentData } from "@/components/ai-elements/attachments"
import { QuestionDialog } from "@/components/question-dialog"
import { ApprovalDialog } from "@/components/approval-dialog"
import { CronMessageCard } from "@/components/cron-message-card"
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
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool"
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
import { SpeechInput } from "@/components/ai-elements/speech-input"
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { CheckIcon, GlobeIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

type QuestionData = InferUIMessageData<NanobotUIMessage>["question"]
type ApprovalData = InferUIMessageData<NanobotUIMessage>["approval"]
export const Route = createFileRoute("/chat")({
  component: ChatPage,
})

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
  const [chatId] = useState<string>(() => {
    const stored = localStorage.getItem("nanobot-chat-id")
    if (stored) return stored
    const newId = nanoid()
    localStorage.setItem("nanobot-chat-id", newId)
    return newId
  })
  const [questionEvent, setQuestionEvent] = useState<QuestionData | null>(null)
  const [approvalEvent, setApprovalEvent] = useState<ApprovalData | null>(null)

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  )

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat({
    chatId,
    onQuestion: (dataPart) => {
      if (dataPart.type !== 'data-question') {
        return
      }
      setQuestionEvent(dataPart.data)
    },
    onApproval: (dataPart) => {
      if (dataPart.type !== 'data-approval') {
        return
      }
      setApprovalEvent(dataPart.data)
    },
    onFinish: ({ finishReason, messageMetadata }) => {
      console.log('流式响应完成:', finishReason)
      console.log('元数据:', messageMetadata)
    },
  })

  const { messages: cronMessages } = useCronEvents(chatId)

  const allMessages = useMemo(() => {
    const uniqueCronMessages = cronMessages.filter((msg, index, self) =>
      index === self.findIndex(m => m.id === msg.id)
    )
    return [...messages, ...uniqueCronMessages]
  }, [messages, cronMessages])

  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      try {
        const history = await getChatHistory(chatId)
        if (cancelled) return

        const mapped = history.map((item) => {
          const role = item.role === "assistant" ? "assistant" : "user"
          if (role === "user") {
            return {
              id: item.id || nanoid(),
              role,
              parts: [{ type: "text", text: item.content }],
              metadata: item.metadata,
            } as NanobotUIMessage
          }
          return {
            id: item.id || nanoid(),
            role,
            parts: Array.isArray(item.parts) ? (item.parts as NanobotUIMessage["parts"]) : [],
            metadata: item.metadata,
          } as NanobotUIMessage
        })
        console.log('加载历史消息:', mapped)
        setMessages(mapped)
      } catch (error) {
        console.error("Failed to load chat history:", error)
        toast.error("加载聊天历史失败")
      }
    }
    void loadHistory()
    return () => {
      cancelled = true
    }
  }, [chatId, setMessages])

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text)
      const hasAttachments = Boolean(message.files?.length)

      if (!(hasText || hasAttachments)) {
        return
      }

      if (status === 'streaming') {
        return
      }

      if (message.files?.length) {
        toast.success("Files attached", {
          description: `${message.files.length} file(s) attached to message`,
        })
      }

      sendMessage({ text: message.text || "Sent with attachments" })
      setText("")
    },
    [sendMessage, status]
  )

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage({ text: suggestion })
    },
    [sendMessage]
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
  }, [chatId, setMessages])

  const isSubmitDisabled = useMemo(
    () => !text.trim() || status === 'streaming',
    [text, status]
  )

  return (
    <div className="relative flex h-full flex-col divide-y">
      <Conversation className="h-full flex-1 overflow-hidden">
        <ConversationContent className="h-full overflow-auto">
        {/* {JSON.stringify(allMessages)} */}
          {allMessages.map((message) => {
            const isCronMessage = message?.metadata?.messageFrom==='cron'

            if (isCronMessage) {
              const content = message.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p as { type: 'text'; text: string }).text)
                .join('') || ''

              return (
                <CronMessageCard
                  key={message.id}
                  content={content}
                  timestamp={564564634654}
                />
              )
            }

            const showBranchChrome =
              message.parts.length > 1 && message.parts.every((p) => p.type === 'text')

            return (
              <MessageBranch defaultBranch={0} key={message.id}>
                <MessageBranchContent>
                  <Message from={message.role}>
                    <div className="flex flex-col gap-2">
                      {message.parts.map((part, partIndex) => {
                        if (part.type === 'text') {
                          return (
                            <MessageContent key={`${message.id}-text-${partIndex}`}>
                              <MessageResponse>{part.text}</MessageResponse>
                            </MessageContent>
                          )
                        }

                        if (part.type.startsWith('tool-') && 'toolCallId' in part) {
                          return (
                            <Tool
                            className="max-w-2xl"
                              defaultOpen={false}
                              key={`${message.id}-tool-${part.toolCallId}-${partIndex}`}
                            >
                              <ToolHeader
                                state={part.state as ToolUIPart["state"]}
                                type={part.type as ToolUIPart["type"]}
                              />
                              <ToolContent>
                                <ToolInput input={part.input} />
                                <ToolOutput
                                  errorText={part.errorText}
                                  output={
                                    part.output && (
                                      <MessageResponse>
                                        {typeof part.output === 'object'
                                          ? JSON.stringify(part.output, null, 2)
                                          : String(part.output)}
                                      </MessageResponse>
                                    )
                                  }
                                />
                              </ToolContent>
                            </Tool>
                          )
                        }

                        return null
                      })}
                    </div>
                  </Message>
                </MessageBranchContent>
                {showBranchChrome && (
                  <MessageBranchSelector>
                    <MessageBranchPrevious />
                    <MessageBranchPage />
                    <MessageBranchNext />
                  </MessageBranchSelector>
                )}
              </MessageBranch>
            )
          })}
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
        <div className="w-full space-y-3 px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              会话ID: {chatId}
            </div>
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
              questionEvent={{
                ...questionEvent,
                channel: 'web',
                chatId,
                timestamp: new Date(questionEvent.timestamp),
              }}
              onClose={() => setQuestionEvent(null)}
            />
          )}
          {approvalEvent && (
            <ApprovalDialog
              approvalEvent={{
                ...approvalEvent,
                channel: 'web',
                chatId,
                timestamp: new Date(approvalEvent.timestamp),
              }}
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
                  {status}
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
             
              <PromptInputSubmit disabled={isSubmitDisabled} onStop={() => { void stop() }} status={status} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}
