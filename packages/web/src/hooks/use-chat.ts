import { useChat as useAiChat } from '@ai-sdk/react';
import { DefaultChatTransport } from '@/lib/nanobot-transport';
import type { NanobotUIMessage, InferUIMessageData, NanobotMessageMetadata } from '@/types/ai-message';
import type { DataUIPart } from 'ai';

export interface UseChatOptions {
  api?: string;
  chatId?: string;
  messages?: NanobotUIMessage[];
  onQuestion?: (data: DataUIPart<InferUIMessageData<NanobotUIMessage>>) => void;
  onApproval?: (data: DataUIPart<InferUIMessageData<NanobotUIMessage>>) => void;
  onFinish?: (data: { finishReason?: string; messageMetadata?: NanobotMessageMetadata }) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { api = '/nanobot/api/v1/messages', chatId, messages, onQuestion, onApproval, onFinish } = options;

  return useAiChat<NanobotUIMessage>({
    messages: messages ?? [],
    transport: new DefaultChatTransport({
      api,
      prepareSendMessagesRequest: ({ messages, body, headers, credentials, api: requestApi }) => {
        const content = [...messages]
          .reverse()
          .find((message) => message.role === 'user')
          ?.parts
          ?.filter((part) => part.type === 'text')
          .map((part) => part.text)
          .join('\n')
          .trim();

        return {
          api: requestApi,
          headers,
          credentials,
          body: {
            content: content || '',
            chatId,
            stream: true,
            metadata: body?.metadata,
          },
        };
      },
    }),
    onData: (dataPart: DataUIPart<InferUIMessageData<NanobotUIMessage>>) => {
      // 处理自定义 data-part 类型
      if (dataPart.type === 'data-question' && onQuestion) {
        onQuestion(dataPart);
        return;
      }
      if (dataPart.type === 'data-approval' && onApproval) {
        onApproval(dataPart);
        return;
      }
    },
    onFinish: ({ finishReason, message }) => {
      if (onFinish) {
        onFinish({
          finishReason,
          messageMetadata: message.metadata as NanobotMessageMetadata | undefined,
        });
      }
    },
  });
}
