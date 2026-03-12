import { useQuery } from "@tanstack/react-query";
import { request } from "@/lib/request";

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  message: string;
  data?: unknown;
}

const queryKeys = {
  all: ["logs"] as const,
  list: () => [...queryKeys.all, "list"] as const,
  levels: () => [...queryKeys.all, "levels"] as const,
};

async function fetchLogs(): Promise<LogEntry[]> {
  return request<LogEntry[]>("/api/v1/logs");
}

async function fetchLogLevels(): Promise<string[]> {
  return request<string[]>("/api/v1/logs/levels");
}

export function useGetLogsQuery(
  _args: void | undefined,
  options?: { refetchInterval?: number | false }
) {
  return useQuery({
    queryKey: queryKeys.list(),
    queryFn: fetchLogs,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useGetLogLevelsQuery() {
  return useQuery({
    queryKey: queryKeys.levels(),
    queryFn: fetchLogLevels,
  });
}

export { queryKeys as logsQueryKeys };
