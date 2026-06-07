import { Decimal } from "@prisma/client/runtime/library";

type MoneyInput = Decimal | string | number | null | undefined;

/** Parse any money-like value into Prisma's Decimal type. */
export function toMoneyDecimal(value: MoneyInput): Decimal {
  if (value == null) {
    return new Decimal(0);
  }

  if (value instanceof Decimal) {
    return value;
  }

  return new Decimal(value.toString());
}

/** Serialize money for JSON: half-up round to exactly 2 decimal places. */
export function toMoneyNumber(value: MoneyInput): number {
  return toMoneyDecimal(value)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** Parse numeric values returned from PostgreSQL `::numeric` raw queries. */
export function parseRawMoney(value: unknown): number {
  if (value == null) {
    return 0;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toFixed" in value &&
    typeof (value as Decimal).toFixed === "function"
  ) {
    return toMoneyNumber(value as Decimal);
  }

  if (typeof value === "number" || typeof value === "string") {
    return toMoneyNumber(value);
  }

  return 0;
}

export function subtractMoney(a: MoneyInput, b: MoneyInput): number {
  return toMoneyNumber(toMoneyDecimal(a).minus(toMoneyDecimal(b)));
}

export function addMoney(...values: MoneyInput[]): number {
  const total = values.reduce(
    (sum: Decimal, value) => sum.plus(toMoneyDecimal(value)),
    new Decimal(0),
  );

  return toMoneyNumber(total);
}

export function netProfitMoney(
  revenue: MoneyInput,
  cogs: MoneyInput,
  expenses: MoneyInput,
): number {
  return toMoneyNumber(
    toMoneyDecimal(revenue)
      .minus(toMoneyDecimal(cogs))
      .minus(toMoneyDecimal(expenses)),
  );
}

export function toPercent(value: MoneyInput): number {
  return toMoneyDecimal(value)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

export function grossMarginPercent(
  grossProfit: MoneyInput,
  revenue: MoneyInput,
): number {
  const revenueDecimal = toMoneyDecimal(revenue);

  if (revenueDecimal.isZero()) {
    return 0;
  }

  return toPercent(toMoneyDecimal(grossProfit).div(revenueDecimal).times(100));
}
