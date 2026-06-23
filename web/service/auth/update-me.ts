import { apiFetch } from "@/service/client";
import type { MeResponse } from "@/types/auth/me";

export interface UpdateMeInput {
  name?: string;
  phone?: string | null;
}

export function updateMe(input: UpdateMeInput): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
