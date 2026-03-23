/**
 * 当前会话信息组件
 *
 * 显示当前会话的元数据和操作
 */

import * as React from 'react';
import { Copy, Archive, Pin, MoreHorizontal, RefreshCw, Edit } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Session } from '@/services/session-api';
import { formatDistanceToNow } from 'date-fns';
import { updateSession, generateSessionTitle, pinSession, archiveSession } from '@/services/session-api';

export interface CurrentSessionInfoProps {
  /** 当前会话 */
  session: Session | null;

  /** 是否忙碌状态 */
  isBusy?: boolean;

  /** 会话选择回调 */
  onSessionChange?: (sessionKey: string) => void;

  /** 取消会话回调 */
  onAbort?: (sessionKey: string) => void;
}

export function CurrentSessionInfo({
  session,
  isBusy = false,
  onSessionChange,
  onAbort,
}: CurrentSessionInfoProps) {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [showRenameDialog, setShowRenameDialog] = React.useState(false);

  const handleRename = async () => {
    if (!session || !newName.trim()) return;

    try {
      await updateSession(session.key, {
        metadata: {
          name: newName.trim(),
        },
      });

      toast.success('Session renamed');
      setShowRenameDialog(false);
      setNewName('');
      setIsRenaming(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename session';
      toast.error(errorMessage);
    }
  };

  const handleGenerateTitle = async () => {
    if (!session) return;

    try {
      await generateSessionTitle(session.key);
      toast.success('Title generated');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate title';
      toast.error(errorMessage);
    }
  };

  const handlePin = async () => {
    if (!session) return;

    try {
      await pinSession(session.key, !session.metadata?.pinned);
      toast.success(session.metadata?.pinned ? 'Session unpinned' : 'Session pinned');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin session';
      toast.error(errorMessage);
    }
  };

  const handleArchive = async () => {
    if (!session) return;

    try {
      await archiveSession(session.key, !session.metadata?.archived);
      toast.success(session.metadata?.archived ? 'Session unarchived' : 'Session archived');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to archive session';
      toast.error(errorMessage);
    }
  };

  const handleCopyKey = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.key);
    toast.success('Session key copied');
  };

  const handleAbort = () => {
    if (!session) return;
    onAbort?.(session.key);
  };

  if (!session) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Session Name/Title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold truncate">
            {session.metadata?.name || session.metadata?.title || session.key}
          </h2>
          {session.metadata?.archived && (
            <Badge variant="secondary" className="text-xs">
              Archived
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{session.messageCount} messages</span>
          {session.lastMessageAt && (
            <>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(session.lastMessageAt), { addSuffix: true })}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleRename}>
            <Edit className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGenerateTitle}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate title
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handlePin}>
            <Pin className={`h-4 w-4 mr-2 ${session.metadata?.pinned ? 'text-yellow-500' : ''}`} />
            {session.metadata?.pinned ? 'Unpin' : 'Pin'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleArchive}>
            <Archive className="h-4 w-4 mr-2" />
            {session.metadata?.archived ? 'Unarchive' : 'Archive'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopyKey}>
            <Copy className="h-4 w-4 mr-2" />
            Copy key
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleAbort}
            disabled={!isBusy}
            className={!isBusy ? 'text-muted-foreground' : 'text-destructive'}
          >
            Cancel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
            <DialogDescription>
              Enter a new name for this session
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="session-name">New name</Label>
              <Input
                id="session-name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={session.metadata?.name || session.metadata?.title || session.key}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
