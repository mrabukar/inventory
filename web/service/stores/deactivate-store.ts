import { apiFetch } from "@/service/client";

export function deactivateStore(id: string): Promise<void> {
  return apiFetch<void>(`/api/stores/${id}/deactivate`, { method: "PATCH" });
}
