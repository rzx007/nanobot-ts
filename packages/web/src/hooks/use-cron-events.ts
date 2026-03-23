import { useEventSource } from './use-event-source';
import type { StreamPartEvent } from '@nanobot/providers';
import { useState, useCallback, useEffect } from 'react';

interface CronMessage {
  id: string;
  role: 'assistant';
  parts: Array<{ type: string; text?: string }>;
  createdAt: number;
  metadata?: { messageFrom?: string };
  status: 'pending' | 'ready';
}

export function useCronEvents(chatId: string) {
  const [messages, setMessages] = useState<CronMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<Map<string, CronMessage>>(new Map());
  
  const baseUrl = import.meta.env.DEV ? '/nanobot' : '';
  const eventsUrl = chatId ? `${baseUrl}/api/v1/events/${chatId}` : null;
  const eventSource = useEventSource(eventsUrl);

  useEffect(() => {
    if (!eventSource) return;

    const handleStreamPart = (event: MessageEvent) => {
      try {
        if (event.data === '[DONE]') return;
        const data = JSON.parse(event.data);

        if (data.type === 'text-start' && data.id) {
          setPendingMessages(prev => {
            const next = new Map(prev);
            const newMessage: CronMessage = {
              id: data.id,
              role: 'assistant',
              parts: [],
              createdAt: Date.now(),
              status: 'pending',
              metadata: {messageFrom: 'cron'},
            };
            next.set(data.id, newMessage);
            return next;
          });
        }

        if (data.type === 'text-delta' && data.id) {
          setPendingMessages(prev => {
            const next = new Map(prev);
            const message = next.get(data.id);
            if (!message) return prev;

            const lastPart = message.parts[message.parts.length - 1];
            if (lastPart && lastPart.type === 'text') {
              lastPart.text = (lastPart.text || '') + data.delta;
            } else {
              message.parts.push({ type: 'text', text: data.delta });
            }

            return next;
          });
        }
      } catch (e) {
        console.error('[useCronEvents] Parse stream-part error:', e);
      }
    };

    const handleStreamFinish = (event: MessageEvent) => {
      try {
        if (event.data === '[DONE]') return;
        const data: { type: string; messageMetadata?: { messageFrom?: string } } = JSON.parse(event.data);
        if (data.type !== 'finish') return;

        setPendingMessages(prev => {
          const next = new Map(prev);
          const firstEntry = next.values().next().value;
          if (!firstEntry || firstEntry.metadata?.messageFrom !== 'cron') return prev;

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
