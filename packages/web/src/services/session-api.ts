/**
 * 会话服务
 *
 * 与后端 API 交互，管理会话数据
 */

import type {
  SessionInfo,
  SessionMetadata,
} from '@nanobot/shared';

export interface Session {
  key: string;
  messageCount: number;
  lastMessageAt?: string | null;
  updatedAt: string;
  metadata?: SessionMetadata;
}

export interface SessionListResponse {
  sessions: Session[];
  total: number;
}

export interface SessionStatus {
  key: string;
  status: {
    type: 'idle' | 'busy' | 'retry' | 'error';
    attempt?: number;
    message?: string;
    next?: number;
    error?: string;
  };
}

export interface SessionStatusesResponse {
  statuses: Record<string, SessionStatus['status']>;
  stats: {
    total: number;
    idle: number;
    busy: number;
    retry: number;
    error: number;
  };
}

const API_BASE = '/api/v1/sessions';

/**
 * 获取所有会话
 */
export async function listSessions(options?: {
  channel?: string;
  archived?: boolean;
  limit?: number;
  search?: string;
}): Promise<SessionListResponse> {
  const params = new URLSearchParams();
  if (options?.channel) params.append('channel', options.channel);
  if (options?.archived !== undefined) params.append('archived', String(options.archived));
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.search) params.append('search', options.search);

  const response = await fetch(`${API_BASE}?${params}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list sessions: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取会话详情
 */
export async function getSession(key: string): Promise<Session> {
  const response = await fetch(`${API_BASE}/${key}`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 创建新会话
 */
export async function createSession(options?: {
  key?: string;
  metadata?: Partial<SessionMetadata>;
}): Promise<Session> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 更新会话元数据
 */
export async function updateSession(
  key: string,
  options: {
    metadata: Partial<SessionMetadata>;
  }
): Promise<Session> {
  const response = await fetch(`${API_BASE}/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error(`Failed to update session: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 删除会话
 */
export async function deleteSession(key: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${key}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.statusText}`);
  }
}

/**
 * 归档/取消归档会话
 */
export async function archiveSession(key: string, archived: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/${key}/archive`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ archived }),
  });

  if (!response.ok) {
    throw new Error(`Failed to archive session: ${response.statusText}`);
  }
}

/**
 * 置顶/取消置顶会话
 */
export async function pinSession(key: string, pinned: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/${key}/pin`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pinned }),
  });

  if (!response.ok) {
    throw new Error(`Failed to pin session: ${response.statusText}`);
  }
}

/**
 * 生成并设置会话标题
 */
export async function generateSessionTitle(key: string): Promise<{ title: string }> {
  const response = await fetch(`${API_BASE}/${key}/title`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to generate session title: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 获取所有会话状态
 */
export async function getSessionStatuses(): Promise<SessionStatusesResponse> {
  const response = await fetch(`${API_BASE}/status`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get session statuses: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取指定会话状态
 */
export async function getSessionStatus(key: string): Promise<SessionStatus> {
  const response = await fetch(`${API_BASE}/${key}/status`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get session status: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * 取消会话处理
 */
export async function abortSession(key: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${key}/abort`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to abort session: ${response.statusText}`);
  }
}

/**
 * 连接会话 SSE 事件流
 */
export function connectSessionEvents(key: string, onMessage: (event: SessionStatus) => void): EventSource {
  const eventSource = new EventSource(`${API_BASE}/${key}/events`);

  eventSource.addEventListener('status', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Failed to parse session event:', error);
    }
  });

  eventSource.addEventListener('error', (error) => {
    console.error('Session events error:', error);
  });

  return eventSource;
}
