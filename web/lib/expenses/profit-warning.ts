import { formatPeriodLabel, getCurrentMonthRange } from "@/lib/filters/dates";
import { fmt } from "@/lib/utils";

export interface ProfitCheckPeriod {
  fromDate: string;
  toDate: string;
}

export function getProfitCheckPeriod(): ProfitCheckPeriod {
  return getCurrentMonthRange();
}

export function isExpenseInPeriod(
  expenseDate: string,
  period: ProfitCheckPeriod,
): boolean {
  const date = expenseDate.slice(0, 10);
  return date >= period.fromDate && date <= period.toDate;
}

export function computeProjectedNetProfit(params: {
  currentNetProfit: number;
  amount: number;
  oldAmount?: number;
}): number {
  const { currentNetProfit, amount, oldAmount = 0 } = params;
  return currentNetProfit + oldAmount - amount;
}

export function shouldWarnExpenseProfit(params: {
  currentNetProfit: number;
  amount: number;
  oldAmount?: number;
  isEdit: boolean;
}): boolean {
  const { currentNetProfit, amount, oldAmount = 0, isEdit } = params;

  if (!isEdit) {
    if (currentNetProfit < 0) return true;
    return amount > currentNetProfit;
  }

  const delta = amount - oldAmount;
  const projectedNetProfit = currentNetProfit - delta;

  if (currentNetProfit < 0 && delta > 0) return true;
  return projectedNetProfit < 0;
}

export function buildProfitWarningMessage(params: {
  currentNetProfit: number;
  amount: number;
  oldAmount?: number;
  isEdit: boolean;
  periodLabel: string;
  scopeLabel: string;
}): {
  title: string;
  message: string;
  projectedNetProfit: number;
  isEdit: boolean;
  oldAmount: number;
  newAmount: number;
  expenseDelta: number;
  netProfitExcludingExpense: number;
} {
  const {
    currentNetProfit,
    amount,
    oldAmount = 0,
    isEdit,
    periodLabel,
    scopeLabel,
  } = params;
  const projectedNetProfit = computeProjectedNetProfit({
    currentNetProfit,
    amount,
    oldAmount,
  });
  const expenseDelta = amount - oldAmount;
  const netProfitExcludingExpense = currentNetProfit + oldAmount;
  const scope = scopeLabel;
  const scopeSuffix = scope !== "company-wide" ? ` (${scope})` : "";

  if (!isEdit && currentNetProfit < 0) {
    return {
      title: "Net profit already negative",
      message: `Company-wide net profit is already ${fmt(currentNetProfit)} for ${periodLabel}. This expense of ${fmt(amount)} will deepen the loss to ${fmt(projectedNetProfit)}.${scopeSuffix}`,
      projectedNetProfit,
      isEdit,
      oldAmount,
      newAmount: amount,
      expenseDelta,
      netProfitExcludingExpense,
    };
  }

  if (!isEdit && amount > currentNetProfit) {
    return {
      title: "Expense exceeds net profit",
      message: `This expense of ${fmt(amount)} exceeds company-wide net profit of ${fmt(currentNetProfit)} for ${periodLabel}. Net profit would become ${fmt(projectedNetProfit)}.${scopeSuffix}`,
      projectedNetProfit,
      isEdit,
      oldAmount,
      newAmount: amount,
      expenseDelta,
      netProfitExcludingExpense,
    };
  }

  if (isEdit && currentNetProfit < 0 && amount > oldAmount) {
    return {
      title: "Increasing expense while at a loss",
      message: `Company-wide net profit is already ${fmt(currentNetProfit)} for ${periodLabel}. Changing this expense from ${fmt(oldAmount)} to ${fmt(amount)} (${expenseDelta >= 0 ? "+" : ""}${fmt(expenseDelta)}) will bring net profit to ${fmt(projectedNetProfit)}.${scopeSuffix}`,
      projectedNetProfit,
      isEdit,
      oldAmount,
      newAmount: amount,
      expenseDelta,
      netProfitExcludingExpense,
    };
  }

  if (isEdit) {
    return {
      title: "Expense exceeds net profit",
      message: `Company-wide net profit is ${fmt(currentNetProfit)} for ${periodLabel}, which already includes this expense at ${fmt(oldAmount)}. Changing it to ${fmt(amount)} (${expenseDelta >= 0 ? "+" : ""}${fmt(expenseDelta)}) would bring net profit to ${fmt(projectedNetProfit)}.${scopeSuffix}`,
      projectedNetProfit,
      isEdit,
      oldAmount,
      newAmount: amount,
      expenseDelta,
      netProfitExcludingExpense,
    };
  }

  return {
    title: "Expense exceeds net profit",
    message: `This change would bring company-wide net profit to ${fmt(projectedNetProfit)} for ${periodLabel}. Current net profit is ${fmt(currentNetProfit)}.${scopeSuffix}`,
    projectedNetProfit,
    isEdit,
    oldAmount,
    newAmount: amount,
    expenseDelta,
    netProfitExcludingExpense,
  };
}

export function formatProfitPeriodLabel(period: ProfitCheckPeriod): string {
  return formatPeriodLabel(period.fromDate, period.toDate);
}
