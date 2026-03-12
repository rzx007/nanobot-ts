import { createFileRoute } from '@tanstack/react-router'
import { useGetLogsQuery, useGetLogLevelsQuery } from '@/services/logs'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { Download, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/settings/logs')({
  component: LogsPage,
})

interface LogFilter {
  search: string
  autoFollow: boolean
  levels: string[]
}

function LogsPage() {
  const { toast } = useToast()
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
    toast({
      title: '日志已刷新',
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
    a.download = `logs-${new Date().toISOString().split('T')[0]}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: '导出成功',
      description: '日志已导出到文件',
    })
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
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

      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">Gateway file logs (JSONL)</p>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-64">
            <Label htmlFor="search" className="block text-sm font-medium mb-1">
              搜索日志
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted">
          <div className="text-sm text-muted-foreground">
            文件: /tmp/openclaw/openclaw-2026-03-12.log
          </div>
        </div>
        
        <div className="h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">时间</TableHead>
                <TableHead className="w-16">级别</TableHead>
                <TableHead className="w-24">模块</TableHead>
                <TableHead>消息</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.length ? (
                filteredLogs.map((log, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-sm">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      <span className={cn(getLevelColor(log.level), 'font-mono text-xs')}>
                        {log.level}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      {log.module}
                    </TableCell>
                    <TableCell className="text-sm">
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