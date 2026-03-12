export interface LogEntry {
  timestamp: string
  level: string
  module: string
  message: string
  data?: any
}

export interface LogFilter {
  search: string
  autoFollow: boolean
  levels: string[]
}