import { useQuery, useMutation } from "@tanstack/react-query";
import { request } from "@/lib/request";
import type { Config } from "@/types/config";

const queryKeys = {
  all: ["config"] as const,
  config: () => [...queryKeys.all, "config"] as const,
};

async function fetchConfig(): Promise<Config> {
  return request<Config>("/api/v1/config");
}

async function updateConfig(config: Config): Promise<Config> {
  return request<Config>("/api/v1/config", {
    method: "PUT",
    body: config,
  });
}

export function useGetConfigQuery(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.config(),
    queryFn: fetchConfig,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export function useUpdateConfigMutation() {
  return useMutation({
    mutationFn: updateConfig,
    // Caller should invalidate config query on success (e.g. queryClient.invalidateQueries({ queryKey: configQueryKeys.config() }))
  });
}

// Re-export the query keys for use in the component
export { queryKeys as configQueryKeys };

// Export the request functions for direct use if needed
export { fetchConfig, updateConfig };

// Re-export the Config type for use in the component
export type { Config };