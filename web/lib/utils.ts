import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const moneyFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const fmt = (n: number | string) => {
  const value = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(value)) return "$0";
  return "$" + moneyFormatter.format(value);
};
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
