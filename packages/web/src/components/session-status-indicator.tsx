/**
 * 会话状态指示器组件
 *
 * 显示当前会话的实时状态（idle/busy/error）
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SessionStatusIndicatorProps {
  /** 状态类型 */
  status: 'idle' | 'busy' | 'retry' | 'error';

  /** 大小 */
  size?: 'sm' | 'md' | 'lg';

  /** 是否显示文字 */
  showText?: boolean;
}

export function SessionStatusIndicator({
  status,
  size = 'md',
  showText = false,
}: SessionStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const statusConfig = {
    idle: {
      icon: '○',
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      label: 'Idle',
    },
    busy: {
      icon: '●',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      label: 'Processing',
    },
    error: {
      icon: '✕',
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      label: 'Error',
    },
    retry: {
      icon: '↻',
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      label: 'Retrying',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'rounded-full flex items-center justify-center animate-pulse',
          sizeClasses[size],
          config.bg,
        )}
        title={config.label}
      >
        <span className={config.color}>{config.icon}</span>
      </div>
      {showText && (
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
