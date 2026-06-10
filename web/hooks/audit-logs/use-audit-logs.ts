"use client";

import { useQuery } from "@tanstack/react-query";
import { listAuditLogs } from "@/service/audit-logs/list-audit-logs";
import type { AuditLogListQuery } from "@/types/audit/audit-log";

export const auditLogsQueryKey = (params: AuditLogListQuery = {}) =>
  ["audit-logs", params] as const;

export function useAuditLogs(params: AuditLogListQuery = {}) {
  return useQuery({
    queryKey: auditLogsQueryKey(params),
    queryFn: () => listAuditLogs(params),
  });
}
