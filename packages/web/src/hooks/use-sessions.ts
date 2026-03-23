/**
 * 会话列表 Hook
 *
 * 管理会话列表、会话选择和会话状态
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as React from 'react';
import { toast } from 'sonner';
import {
  listSessions,
  getSessionStatuses,
  type Session,
  type SessionStatusesResponse,
  connectSessionEvents,
} from '@/services/session-api';

export interface UseSessionsOptions {
  /** 自动刷新间隔（毫秒），默认 30000 */
  refreshInterval?: number;

  /** 是否连接 SSE 事件流 */
  enableSSE?: boolean;
}

export interface UseSessionsReturn {
  /** 会话列表 */
  sessions: Session[];

  /** 是否正在加载 */
  isLoading: boolean;

  /** 错误信息 */
  error: string | null;

  /** 当前选中的会话 */
  selectedSession: Session | null;

  /** 会话状态映射 */
  sessionStatuses: Record<string, SessionStatusesResponse['statuses'][string]>;

  /** 刷新会话列表 */
  refresh: () => Promise<void>;

  /** 选择会话 */
  selectSession: (sessionKey: string) => void;

  /** 取消会话处理 */
  abortSession: (sessionKey: string) => Promise<void>;

  /** 创建新会话 */
  createSession: () => Promise<Session>;

  /** 归档会话 */
  archiveSession: (sessionKey: string) => Promise<void>;

  /** 置顶会话 */
  pinSession: (sessionKey: string) => Promise<void>;

  /** 删除会话 */
  deleteSession: (sessionKey: string) => Promise<void>;

  /** 搜索会话 */
  searchSessions: (query: string) => Promise<void>;
}

export function useSessions(options?: UseSessionsOptions): UseSessionsReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionStatuses, setSessionStatuses] = useState<
    Record<string, SessionStatusesResponse['statuses'][string]>
  >({});
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshIntervalRef = useRef<number | null>(null);

  // 刷新会话列表
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listSessions();
      setSessions(response.sessions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 选择会话
  const selectSession = useCallback((sessionKey: string) => {
    const session = sessions.find(s => s.key === sessionKey);
    setSelectedSession(session || null);
  }, [sessions]);

  // 取消会话处理
  const abortSession = useCallback(async (sessionKey: string) => {
    try {
      await fetch(`/api/v1/sessions/${sessionKey}/abort`, {
        method: 'POST',
      });
      toast.success('Session aborted');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to abort session';
      toast.error(errorMessage);
    }
  }, []);

  // 创建新会话
  const createSession = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      toast.success('New session created');

      await refresh();

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      toast.error(errorMessage);
      throw err;
    }
  }, [refresh]);

  // 归档会话
  const archive = useCallback(async (sessionKey: string) => {
    try {
      await fetch(`/api/v1/sessions/${sessionKey}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      });

      toast.success('Session archived');
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive session';
      toast.error(errorMessage);
    }
  }, [refresh]);

  // 置顶会话
  const pin = useCallback(async (sessionKey: string) => {
    const session = sessions.find(s => s.key === sessionKey);
    if (!session) return;

    try {
      await fetch(`/api/v1/sessions/${sessionKey}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pinned: !session.metadata?.pinned }),
      });

      toast.success(session.metadata?.pinned ? 'Session unpinned' : 'Session pinned');
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin session';
      toast.error(errorMessage);
    }
  }, [sessions, refresh]);

  // 删除会话
  const deleteSession = useCallback(async (sessionKey: string) => {
    try {
      await fetch(`/api/v1/sessions/${sessionKey}`, {
        method: 'DELETE',
      });

      toast.success('Session deleted');
      await refresh();

      if (selectedSession?.key === sessionKey) {
        setSelectedSession(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      toast.error(errorMessage);
    }
  }, [selectedSession, refresh]);

  // 搜索会话
  const searchSessions = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listSessions({ search: query });
      setSessions(response.sessions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search sessions';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载会话状态
  const loadSessionStatuses = useCallback(async () => {
    try {
      const response = await getSessionStatuses();
      setSessionStatuses(response.statuses);
    } catch (err) {
      console.error('Failed to load session statuses:', err);
    }
  }, []);

  // 初始化：加载会话列表
  useEffect(() => {
    refresh();
  }, [refresh]);

  // 定时刷新会话列表
  useEffect(() => {
    if (!options?.refreshInterval) return;

    refreshIntervalRef.current = window.setInterval(() => {
      refresh();
    }, options.refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refresh, options?.refreshInterval]);

  // 初始化：加载会话状态
  useEffect(() => {
    loadSessionStatuses();
  }, [loadSessionStatuses]);

  // SSE 事件流
  useEffect(() => {
    if (!options?.enableSSE) return;

    const eventSource = connectSessionEvents('all', (event) => {
      setSessionStatuses(prev => ({
        ...prev,
        [event.key]: event.status,
      }));
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [options?.enableSSE]);

  return {
    sessions,
    isLoading,
    error,
    selectedSession,
    sessionStatuses,
    refresh,
    selectSession,
    abortSession,
    createSession,
    archiveSession: pinSession,
    deleteSession,
    searchSessions,
  };
}
