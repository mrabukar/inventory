import { apiFetch } from "@/service/client";
import type { TwoFactorAction } from "@/types/users/user";

export function manageUserTwoFactor(
  id: string,
  action: TwoFactorAction,
): Promise<void> {
  return apiFetch<void>(`/api/users/${id}/two-factor`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}
