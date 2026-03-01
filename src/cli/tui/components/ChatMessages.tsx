import type { MessageItem } from './MessageList';
import { MessageList } from './MessageList';

interface ChatMessagesProps {
  messages: MessageItem[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  return <MessageList messages={messages} />;
}
