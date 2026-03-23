/**
 * 会话列表组件
 *
 * 显示所有会话，支持搜索、归档、删除等操作
 */

import * as React from 'react';
import { MoreHorizontal, Search, Archive, Pin, Plus, Trash2, Edit } from 'lucide-react';
import { useSessions } from '@/hooks/use-sessions';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarSeparator,
  SidebarInput,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export interface SessionListProps {
  /** 当前激活的会话键 */
  activeSessionKey?: string;

  /** 会话选择回调 */
  onSessionSelect?: (sessionKey: string) => void;

  /** 是否显示搜索框 */
  showSearch?: boolean;
}

export function SessionList({
  activeSessionKey,
  onSessionSelect,
  showSearch = false,
}: SessionListProps) {
  const {
    sessions,
    isLoading,
    selectSession,
    abortSession,
    createSession,
    archiveSession,
    pinSession,
    deleteSession,
    searchSessions,
  } = useSessions({
    refreshInterval: 30000,
    enableSSE: true,
  });

  const [searchQuery, setSearchQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearching(true);
    await searchSessions(searchQuery);
    setSearching(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = async () => {
    setSearchQuery('');
    await searchSessions('');
  };

  const groupedSessions = React.useMemo(() => {
    const pinned = sessions.filter(s => s.metadata?.pinned);
    const recent = sessions
      .filter(s => !s.metadata?.pinned && !s.metadata?.archived)
      .sort((a, b) => {
        const dateA = a.lastMessageAt || a.updatedAt;
        const dateB = b.lastMessageAt || b.updatedAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    const archived = sessions.filter(s => s.metadata?.archived);

    return { pinned, recent, archived };
  }, [sessions]);

  const getStatusColor = (status: { type: string }) => {
    switch (status.type) {
      case 'busy':
        return 'text-blue-500';
      case 'error':
        return 'text-red-500';
      case 'retry':
        return 'text-yellow-500';
      default:
        return 'text-green-500';
    }
  };

  const getStatusIcon = (status: { type: string }) => {
    switch (status.type) {
      case 'busy':
        return '●';
      case 'error':
        return '✕';
      case 'retry':
        return '↻';
      default:
        return '○';
    }
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarHeader className="flex items-center gap-2">
          {showSearch && (
            <form onSubmit={handleSearch} className="flex-1">
              <SidebarInput
                type="search"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={handleSearchChange}
                rightElement={
                  searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={clearSearch}
                      className="h-7 w-7"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  )
                }
              />
            </form>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={createSession}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">New session</span>
          </Button>
        </SidebarHeader>

        <SidebarSeparator />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading sessions...</div>
          </div>
        ) : (
          <>
            {/* Pinned Sessions */}
            {groupedSessions.pinned.length > 0 && (
              <>
                <SidebarGroup>
                  <SidebarGroupLabel>Pinned</SidebarGroupLabel>
                  <SidebarMenu>
                    {groupedSessions.pinned.map((session) => {
                      const isActive = session.key === activeSessionKey;
                      const status = session.sessionStatuses?.[session.key];

                      return (
                        <SidebarMenuItem key={session.key}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => onSessionSelect?.(session.key)}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Pin className="h-3 w-3 text-yellow-500" />
                              <span className="truncate">
                                {session.metadata?.name || session.metadata?.title || session.key}
                              </span>
                            </div>
                            <SidebarMenuAction showOnHover>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      navigator.clipboard.writeText(session.key);
                                      toast.success('Session key copied');
                                    }}
                                  >
                                    Copy key
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => pinSession(session.key)}>
                                    <Archive className="h-4 w-4 mr-2" />
                                    Unpin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => archiveSession(session.key)}
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => deleteSession(session.key)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SidebarMenuAction>
                            {status && (
                              <SidebarMenuBadge>
                                <span className={cn('text-xs', getStatusColor(status))}>
                                  {getStatusIcon(status)}
                                </span>
                              </SidebarMenuBadge>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
                <SidebarSeparator />
              </>
            )}

            {/* Recent Sessions */}
            <SidebarGroup>
              <SidebarGroupLabel>Recent</SidebarGroupLabel>
              <SidebarMenu>
                {groupedSessions.recent.length > 0 ? (
                  groupedSessions.recent.map((session) => {
                    const isActive = session.key === activeSessionKey;
                    const status = session.sessionStatuses?.[session.key];

                    return (
                      <SidebarMenuItem key={session.key}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => onSessionSelect?.(session.key)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate">
                              {session.metadata?.name || session.metadata?.title || session.key}
                            </span>
                          </div>
                          <SidebarMenuAction showOnHover>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0">
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard.writeText(session.key);
                                    toast.success('Session key copied');
                                  }}
                                >
                                  Copy key
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => pinSession(session.key)}>
                                  <Pin className="h-4 w-4 mr-2" />
                                  Pin
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => archiveSession(session.key)}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => deleteSession(session.key)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {status && (
                              <SidebarMenuBadge>
                                <span className={cn('text-xs', getStatusColor(status))}>
                                  {getStatusIcon(status)}
                                </span>
                              </SidebarMenuBadge>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  ) : (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      No recent sessions
                    </div>
                  )}
                </SidebarMenu>
              </SidebarGroup>

              {/* Archived Sessions */}
              {groupedSessions.archived.length > 0 && (
                <>
                  <SidebarSeparator />
                  <SidebarGroup>
                    <SidebarGroupLabel>Archived ({groupedSessions.archived.length})</SidebarGroupLabel>
                    <SidebarMenu>
                      {groupedSessions.archived.map((session) => {
                        const isActive = session.key === activeSessionKey;

                        return (
                          <SidebarMenuItem key={session.key}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => onSessionSelect?.(session.key)}
                              className="opacity-60"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="truncate">
                                  {session.metadata?.name || session.metadata?.title || session.key}
                                </span>
                                {session.lastMessageAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroup>
                </>
              )}
            </>
          )}
        )}
      </SidebarContent>
    </Sidebar>
  );
}
