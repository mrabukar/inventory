/** API origin for fetches. Empty string in the browser = same host (multi-subdomain). */
export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured;
  if (typeof window !== "undefined") return "";
  return "http://127.0.0.1:4000";
}
