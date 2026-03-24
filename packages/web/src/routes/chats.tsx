import { createFileRoute } from '@tanstack/react-router'
import { ChatWithSessionsPage } from '@/components/chat-with-sessions'

export const Route = createFileRoute('/chats')({
  component: ChatWithSessionsPage,
})
