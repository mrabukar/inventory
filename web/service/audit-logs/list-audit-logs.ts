import { apiFetch } from "@/service/client";
import type {
  AuditLogListQuery,
  AuditLogListResponse,
} from "@/types/audit/audit-log";

function toQueryString(params: AuditLogListQuery = {}): string {
  const search = new URLSearchParams();

  if (params.page != null) search.set("page", String(params.page));
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.search) search.set("search", params.search);
  if (params.userId) search.set("userId", params.userId);
  if (params.action) search.set("action", params.action);
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.entityId) search.set("entityId", params.entityId);
  if (params.fromDate) search.set("fromDate", params.fromDate);
  if (params.toDate) search.set("toDate", params.toDate);

  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listAuditLogs(
  params: AuditLogListQuery = {},
): Promise<AuditLogListResponse> {
  return apiFetch<AuditLogListResponse>(
    `/api/audit-logs${toQueryString(params)}`,
  );
}
