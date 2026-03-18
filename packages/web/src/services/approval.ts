import { useQuery, useMutation } from "@tanstack/react-query";
import { request } from "@/lib/request";
import type { ApprovalEvent } from "@nanobot/shared";

const queryKeys = {
  all: ["approvals"] as const,
  status: () => [...queryKeys.all, "status"] as const,
};

async function replyApproval(requestID: string, approved: boolean): Promise<{
  success: boolean;
  message: string;
  data: { requestID: string; approved: boolean };
}> {
  return request(`/api/v1/approvals/${requestID}/reply`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

async function cancelApproval(requestID: string): Promise<{
  success: boolean;
  message: string;
  data: { requestID: string };
}> {
  return request(`/api/v1/approvals/${requestID}/cancel`, {
    method: "POST",
  });
}

async function fetchApprovalStatus(): Promise<{
  success: boolean;
  data: { pendingCount: number };
}> {
  return request("/api/v1/approvals/status");
}

export function useReplyApprovalMutation() {
  return useMutation({
    mutationFn: ({ requestID, approved }: { requestID: string; approved: boolean }) =>
      replyApproval(requestID, approved),
  });
}

export function useCancelApprovalMutation() {
  return useMutation({
    mutationFn: (requestID: string) => cancelApproval(requestID),
  });
}

export function useGetApprovalStatusQuery(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.status(),
    queryFn: fetchApprovalStatus,
    refetchInterval: options?.refetchInterval ?? false,
  });
}

export { queryKeys as approvalQueryKeys };

export { replyApproval, cancelApproval, fetchApprovalStatus };

export type { ApprovalEvent };
