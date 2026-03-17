import { useState, useEffect } from 'react';

export function useEventSource(url: string | null): EventSource | null {
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      queueMicrotask(() => setEventSource(null));
      return;
    }

    const es = new EventSource(url);
    queueMicrotask(() => setEventSource(es));

    return () => {
      es.close();
      queueMicrotask(() => setEventSource(null));
    };
  }, [url]);

  return eventSource;
}
