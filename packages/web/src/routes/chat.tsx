import { createFileRoute } from "@tanstack/react-router"
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input"
import type { ToolUIPart } from "ai"
import type { QuestionEvent, ApprovalEvent } from "@nanobot/shared"

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments"
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
import { useCallback, useMemo, useState } from "react"
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
    description: string
    status: ToolUIPart["state"]
    parameters: Record<string, unknown>
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

const AttachmentItem = ({
  attachment,
  onRemove,
}: {
  attachment: { id: string; name: string; type: string; url: string }
  onRemove: (id: string) => void
}) => {
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

const PromptInputAttachmentsDisplay = () => {
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

const SuggestionItem = ({
  suggestion,
  onClick,
}: {
  suggestion: string
  onClick: (suggestion: string) => void
}) => {
  const handleClick = useCallback(() => {
    onClick(suggestion)
  }, [onClick, suggestion])

  return <Suggestion onClick={handleClick} suggestion={suggestion} />
}

const ModelItem = ({
  m,
  isSelected,
  onSelect,
}: {
  m: (typeof models)[0]
  isSelected: boolean
  onSelect: (id: string) => void
}) => {
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

const ChatPage = () => {
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

  const selectedModelData = useMemo(
    () => models.find((m) => m.id === model),
    [model]
  )

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

      const assistantMessageId = `assistant-${Date.now()}`
      const assistantMessage: MessageType = {
        from: "assistant",
        key: `assistant-${Date.now()}`,
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
          onChunk: (chunk) => {
            fullContent += chunk
            updateMessageContent(assistantMessageId, fullContent)
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
    [chatId, updateMessageContent]
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

  const isSubmitDisabled = useMemo(
    () => !text.trim() || isStreaming,
    [text, isStreaming]
  )

  return (
    <div className="relative flex h-full flex-col divide-y">
      <Conversation className="h-full flex-1 overflow-hidden">
        <ConversationContent className="h-full overflow-auto">
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
