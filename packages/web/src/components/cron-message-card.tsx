import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface CronMessageCardProps {
  content: string
  timestamp?: number
  status?: 'pending' | 'ready'
  className?: string
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return ''
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function CronMessageCard({
  content,
  timestamp,
  status = 'ready',
  className
}: CronMessageCardProps) {
  const timeAgo = formatTimeAgo(timestamp)

  const fullTime = timestamp ? new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) : ''

  return (
    <Card
      data-slot="card"
      size="sm"
      className={cn(
        "w-full max-w-2xl mx-auto my-2",
        status === 'pending' && "opacity-70",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start gap-3 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            <span>定时任务</span>
            {status === 'pending' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                接收中
              </span>
            )}
          </CardTitle>
          <time 
            dateTime={new Date(timestamp).toISOString()}
            className="text-[10px] text-muted-foreground"
            title={fullTime}
          >
            {timeAgo}
          </time>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </p>
          {status === 'pending' && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-1 flex-1 rounded-full bg-muted" />
              <div className="h-1 flex-1 rounded-full bg-muted animate-pulse" />
              <div className="h-1 flex-1 rounded-full bg-muted animate-pulse" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
