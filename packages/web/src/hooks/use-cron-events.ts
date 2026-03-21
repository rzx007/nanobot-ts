import { useEventSource } from './use-event-source';
import type { StreamPartEvent } from '@nanobot/providers';
import { useState, useCallback, useEffect } from 'react';

interface CronMessage {
  id: string;
  role: 'assistant';
  parts: Array<{ type: string; text?: string }>;
  createdAt: number;
  status: 'pending' | 'ready';
}

export function useCronEvents(chatId: string) {
  const [messages, setMessages] = useState<CronMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Map<string, CronMessage>>(new Map());
  
  const eventsUrl = chatId ? `/nanobot/api/v1/events/${chatId}` : null;
  const eventSource = useEventSource(eventsUrl);

  useEffect(() => {
    if (!eventSource) return;

    const handleStreamPart = (event: MessageEvent) => {
      try {
        const data: StreamPartEvent = JSON.parse(event.data);
        if (data.channel !== 'http' || data.chatId !== chatId) return;
        if (data.senderId !== 'cron') return;

        setPendingMessages(prev => {
          const next = new Map(prev);
          const messageId = `cron-${Date.now()}`;
          
          if (!next.has(messageId)) {
            const newMessage: CronMessage = {
              id: messageId,
              role: 'assistant',
              parts: [],
              createdAt: Date.now(),
              status: 'pending',
            };
            next.set(messageId, newMessage);
          }

          const message = next.get(messageId)!;
          if (data.part.type === 'text-delta') {
            const lastPart = message.parts[message.parts.length - 1];
            if (lastPart && lastPart.type === 'text') {
              lastPart.text = (lastPart.text || '') + data.part.delta;
            } else {
              message.parts.push({ type: 'text', text: data.part.delta });
            }
          }

          return next;
        });
      } catch (e) {
        console.error('[useCronEvents] Parse stream-part error:', e);
      }
    };

    const handleStreamFinish = (event: MessageEvent) => {
      try {
        const data: { type: string; messageMetadata?: { messageFrom?: string } } = JSON.parse(event.data);
        if (data.type !== 'finish') return;
        if (data.messageMetadata?.messageFrom !== 'cron') return;

        setPendingMessages(prev => {
          const next = new Map(prev);
          const firstEntry = next.values().next().value;
          if (!firstEntry) return prev;

          const message = { ...firstEntry, status: 'ready' as const };
          next.delete(firstEntry.id);
          
          setMessages(prevMessages => [...prevMessages, message]);
          return next;
        });
      } catch (e) {
        console.error('[useCronEvents] Parse stream-finish error:', e);
      }
    };

    eventSource.addEventListener('message', handleStreamPart);
    eventSource.addEventListener('message', handleStreamFinish);

    return () => {
      eventSource.removeEventListener('message', handleStreamPart);
      eventSource.removeEventListener('message', handleStreamFinish);
    };
  }, [eventSource, chatId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingMessages(new Map());
  }, []);

  return {
    messages: [...pendingMessages.values(), ...messages],
    pendingMessages: Array.from(pendingMessages.values()),
    readyMessages: messages,
    clearMessages,
  };
}
