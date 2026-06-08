import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const fmt = (n: number) => "$" + Math.round(n).toLocaleString();
export const fmtK = (n: number) => "$" + (n / 1000).toFixed(1) + "k";
export const fmtPct = (n: number, decimals = 1) =>
  (n >= 0 ? "+" : "") + n.toFixed(decimals) + "%";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}
