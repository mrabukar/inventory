import { apiFetch } from "@/service/client";

export function deactivateUser(id: string): Promise<void> {
  return apiFetch<void>(`/api/users/${id}/deactivate`, {
    method: "PATCH",
  });
}
