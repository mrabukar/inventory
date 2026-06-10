import { apiFetch } from "@/service/client";
import type { User } from "@/types/users/user";

export function activateUser(id: string): Promise<User> {
  return apiFetch<User>(`/api/users/${id}/activate`, {
    method: "PATCH",
  });
}
