import { apiFetch } from "@/service/client";

export function resetUserTwoFactor(id: string): Promise<void> {
  return apiFetch<void>(`/api/users/${id}/two-factor`, {
    method: "PATCH",
  });
}
