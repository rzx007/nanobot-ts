import type { MessageItem } from '../components/MessageList';
import { MessageList } from '../components/MessageList';

interface ChatMessagesProps {
  messages: MessageItem[];
}

export function ChatMessages({ messages }: ChatMessagesProps) {
  return <MessageList messages={messages} />;
}
