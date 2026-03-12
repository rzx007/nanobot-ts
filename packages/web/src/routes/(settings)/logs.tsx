import { createFileRoute } from '@tanstack/react-router'
import { useGetLogsQuery, useGetLogLevelsQuery } from '@/services/logs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from "sonner"
import { cn } from '@/lib/utils'
import { Download, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/(settings)/logs')({
  component: LogsPage,
})

interface LogFilter {
  search: string
  autoFollow: boolean
  levels: string[]
}

function LogsPage() {
  const [filters, setFilters] = useState<LogFilter>({
    search: '',
    autoFollow: true,
    levels: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
  })

  const { data: logs, refetch } = useGetLogsQuery(undefined, {
    refetchInterval: filters.autoFollow ? 5000 : false,
  })

  const { data: logLevels } = useGetLogLevelsQuery()

  const handleRefresh = () => {
    refetch()
    toast.info('日志已刷新', {
      description: '已重新加载最新日志',
    })
  }

  const handleExport = () => {
    if (!logs) return

    const logText = logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.module}] ${log.message}`
    ).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs-${new Date().toISOString().split(`T`)[0]}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('日志已导出到文件')
  }

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = filters.search === '' ||
      log.message.toLowerCase().includes(filters.search.toLowerCase()) ||
      log.module.toLowerCase().includes(filters.search.toLowerCase())

    const matchesLevel = filters.levels.includes(log.level)

    return matchesSearch && matchesLevel
  })

  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      trace: 'text-gray-500',
      debug: 'text-blue-500',
      info: 'text-green-500',
      warn: 'text-yellow-500',
      error: 'text-red-500',
      fatal: 'text-red-600',
    }
    return colors[level] || 'text-gray-500'
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex shrink-0 items-center justify-between">
        <h1 className="text-2xl font-bold">日志</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            导出可见
          </Button>
        </div>
      </div>

      <div className="shrink-0">
        <p className="mb-2 text-sm text-muted-foreground">Gateway file logs (JSONL)</p>

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="flex-1 min-w-64">
            <Label htmlFor="search" className="block text-sm font-medium mb-1">
              搜索日志
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="搜索日志..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-follow"
              checked={filters.autoFollow}
              onCheckedChange={(checked) => setFilters({ ...filters, autoFollow: checked as boolean })}
            />
            <Label htmlFor="auto-follow" className="text-sm font-medium">
              自动跟随
            </Label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {logLevels?.map((level) => (
            <div key={level} className="flex items-center gap-1">
              <Checkbox
                id={`level-${level}`}
                checked={filters.levels.includes(level)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setFilters({ ...filters, levels: [...filters.levels, level] })
                  } else {
                    setFilters({ ...filters, levels: filters.levels.filter(l => l !== level) })
                  }
                }}
              />
              <Label htmlFor={`level-${level}`} className="text-sm">
                {level}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card w-full">
        <div className="shrink-0 border-b bg-muted px-4 py-3">
          <div className="text-sm text-muted-foreground">
            文件: ~/nanobot/workspace/logs/nanobot.log
          </div>
        </div>

        <div className="flex-1 min-h-0 min-w-0 overflow-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-24 shrink-0">时间</TableHead>
                <TableHead className="w-16 shrink-0">级别</TableHead>
                <TableHead className="w-24 shrink-0">模块</TableHead>
                <TableHead className="min-w-0">消息</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.length ? (
                filteredLogs.map((log, index) => (
                  <TableRow key={index}>
                    <TableCell className="shrink-0 text-sm w-24">
                      {log.timestamp}
                    </TableCell>
                    <TableCell className="shrink-0 w-16">
                      <span className={cn(getLevelColor(log.level), 'font-mono text-xs')}>
                        {log.level}
                      </span>
                    </TableCell>
                    <TableCell className="shrink-0 text-sm font-mono w-24 truncate max-w-24" title={log.module}>
                      {log.module}
                    </TableCell>
                    <TableCell className="min-w-0 text-sm whitespace-normal wrap-break-word">
                      {log.message}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    没有找到日志
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}