import { apiFetch } from "@/service/client";

export function disableOwnTwoFactor(input: {
  password: string;
  code: string;
}): Promise<void> {
  return apiFetch<void>("/api/me/two-factor/disable", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
