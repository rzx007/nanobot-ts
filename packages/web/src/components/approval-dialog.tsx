import { useState } from 'react';
import { AlertTriangle, Clock, Terminal } from 'lucide-react';
import { replyApproval, cancelApproval } from '@/services/approval';
import type { ApprovalEvent } from '@nanobot/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ApprovalDialogProps {
  approvalEvent: ApprovalEvent;
  onClose: () => void;
}

export function ApprovalDialog({ approvalEvent, onClose }: ApprovalDialogProps) {
  const [loading, setLoading] = useState(false);

  const formatParams = (params: Record<string, unknown>): string => {
    return Object.entries(params)
      .map(([key, value]) => {
        const valueStr = JSON.stringify(value);
        const truncated = valueStr.length > 50 ? `${valueStr.slice(0, 50)}...` : valueStr;
        return `${key}=${truncated}`;
      })
      .join('\n');
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await replyApproval(approvalEvent.requestID, true);
      onClose();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await replyApproval(approvalEvent.requestID, false);
      onClose();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelApproval(approvalEvent.requestID);
      onClose();
    } catch (error) {
      console.error('Failed to cancel approval:', error);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            工具执行需要确认
          </DialogTitle>
          <DialogDescription>
            以下工具请求需要您的批准才能执行
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Terminal className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">工具名称</p>
              <p className="font-mono text-sm font-medium truncate">
                {approvalEvent.toolName}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">参数</p>
            <div className="rounded-lg bg-muted p-3 max-h-32 overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {formatParams(approvalEvent.params)}
              </pre>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>超时时间: {approvalEvent.timeout}秒</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={loading}
            className="flex-1"
          >
            取消请求
          </Button>
          <div className="flex gap-2 flex-1 sm:flex-none">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={loading}
              className="flex-1"
            >
              拒绝
            </Button>
            <Button
              onClick={handleApprove}
              disabled={loading}
              className="flex-1"
            >
              {loading ? '处理中...' : '确认'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
