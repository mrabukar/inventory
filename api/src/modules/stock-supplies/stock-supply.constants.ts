export const STOCK_SUPPLY_TYPES = [
  "supply",
  "correction_add",
  "correction_subtract",
] as const;

export type StockSupplyTypeValue = (typeof STOCK_SUPPLY_TYPES)[number];
