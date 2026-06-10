import { apiFetch } from "@/service/client";
import type { UpdateUserInput, User } from "@/types/users/user";

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return apiFetch<User>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
