import { apiFetch } from "@/service/client";
import type { MeResponse } from "@/types/auth/me";

export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/api/me");
}
