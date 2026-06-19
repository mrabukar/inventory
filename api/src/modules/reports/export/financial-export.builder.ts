import ExcelJS from "exceljs";
import type { Content, TableCell } from "pdfmake/interfaces";
import { buildExportFilename, formatExportMoney } from "./export-format.util";
import {
  applyMetaRows,
  applyNoticeRow,
  applyWorksheetTitle,
  freezeHeaderAndFilter,
  setCurrencyCell,
  setIntegerCell,
  setPercentCell,
  styleTableHeaderRow,
} from "./excel-export.util";
import {
  buildFinancialMetaRows,
  buildSummaryMetrics,
  FINANCIAL_EMPTY_NOTICE,
  hasFinancialActivity,
  hasMonthlyActivity,
} from "./financial-export.helpers";
import { renderPdf } from "./pdfmake.util";
import {
  buildPdfDataTable,
  buildPdfSection,
  buildReportPdfDocument,
} from "./pdf-export.util";
import type { ExportFileResult, ReportExportContext } from "./report-export.types";

type FinancialSummaryData = Awaited<
  ReturnType<
    import("../reports.service").ReportsService["getFinancialSummary"]
  >
>;

function applySummaryMetricCell(
  row: ExcelJS.Row,
  kind: "money" | "integer" | "percent" | "text",
  value: number | string,
): void {
  const cell = row.getCell(2);
  if (kind === "text") {
    cell.value = value;
    return;
  }
  if (typeof value !== "number") {
    cell.value = value;
    return;
  }
  if (kind === "money") {
    setCurrencyCell(cell, value);
    return;
  }
  if (kind === "integer") {
    setIntegerCell(cell, value);
    return;
  }
  setPercentCell(cell, value);
}

function addDataSheetHeader(
  sheet: ExcelJS.Worksheet,
  context: ReportExportContext,
  columnCount: number,
  showEmptyNotice: boolean,
): number {
  applyWorksheetTitle(
    sheet,
    `${context.reportTitle} — ${context.organizationName}`,
    columnCount,
  );
  sheet.addRow([]);
  applyMetaRows(sheet, buildFinancialMetaRows(context));
  sheet.addRow([]);
  if (showEmptyNotice) {
    applyNoticeRow(sheet, FINANCIAL_EMPTY_NOTICE, columnCount);
    sheet.addRow([]);
  }
  return sheet.rowCount;
}

export async function buildFinancialExcel(
  data: FinancialSummaryData,
  context: ReportExportContext,
): Promise<ExportFileResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.organizationName;
  workbook.created = new Date();
  const showEmptyNotice = !hasFinancialActivity(data);

  const summarySheet = workbook.addWorksheet("Summary", {
    views: [{ showGridLines: true }],
  });
  addDataSheetHeader(summarySheet, context, 2, showEmptyNotice);
  const summaryHeaderRow = summarySheet.rowCount + 1;
  summarySheet.addRow(["Metric", "Value"]);
  styleTableHeaderRow(summarySheet, summaryHeaderRow, 2);
  for (const metric of buildSummaryMetrics(data)) {
    const row = summarySheet.addRow([metric.label, null]);
    applySummaryMetricCell(row, metric.kind, metric.value);
  }
  summarySheet.columns = [{ width: 30 }, { width: 20 }];
  freezeHeaderAndFilter(
    summarySheet,
    summaryHeaderRow,
    summarySheet.rowCount,
    2,
  );

  const pnlSheet = workbook.addWorksheet("P&L");
  addDataSheetHeader(pnlSheet, context, 2, showEmptyNotice);
  const pnlHeaderRow = pnlSheet.rowCount + 1;
  pnlSheet.addRow(["Line", "Amount"]);
  styleTableHeaderRow(pnlSheet, pnlHeaderRow, 2);
  const { breakdown } = data;
  for (const [label, value] of [
    ["Revenue", breakdown.revenue],
    ["COGS", breakdown.cogs],
    ["Gross Profit", breakdown.grossProfit],
    ["Expenses", breakdown.expenses],
    ["Net Profit", breakdown.netProfit],
  ] as const) {
    const row = pnlSheet.addRow([label, null]);
    setCurrencyCell(row.getCell(2), value);
    if (label === "Net Profit") {
      row.font = { bold: true };
    }
  }
  pnlSheet.columns = [{ width: 22 }, { width: 18 }];
  freezeHeaderAndFilter(pnlSheet, pnlHeaderRow, pnlSheet.rowCount, 2);

  const monthlySheet = workbook.addWorksheet("Monthly");
  addDataSheetHeader(monthlySheet, context, 5, !hasMonthlyActivity(data));
  const monthlyHeaderRow = monthlySheet.rowCount + 1;
  monthlySheet.addRow(["Month", "Revenue", "COGS", "Expenses", "Net Profit"]);
  styleTableHeaderRow(monthlySheet, monthlyHeaderRow, 5);
  for (const row of data.charts.revenueCogsExpenses) {
    const net = row.revenue - row.cogs - row.expenses;
    const excelRow = monthlySheet.addRow([row.month, null, null, null, null]);
    setCurrencyCell(excelRow.getCell(2), row.revenue);
    setCurrencyCell(excelRow.getCell(3), row.cogs);
    setCurrencyCell(excelRow.getCell(4), row.expenses);
    setCurrencyCell(excelRow.getCell(5), net);
  }
  monthlySheet.columns = [
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  freezeHeaderAndFilter(
    monthlySheet,
    monthlyHeaderRow,
    monthlySheet.rowCount,
    5,
  );

  const expensesSheet = workbook.addWorksheet("Expenses");
  const expensesEmpty = data.expenseByCategory.length === 0;
  addDataSheetHeader(expensesSheet, context, 2, expensesEmpty);
  const expensesHeaderRow = expensesSheet.rowCount + 1;
  expensesSheet.addRow(["Category", "Amount"]);
  styleTableHeaderRow(expensesSheet, expensesHeaderRow, 2);
  if (expensesEmpty) {
    expensesSheet.addRow(["No expenses recorded in this period.", null]);
  } else {
    for (const row of data.expenseByCategory) {
      const excelRow = expensesSheet.addRow([row.categoryName, null]);
      setCurrencyCell(excelRow.getCell(2), row.amount);
    }
  }
  expensesSheet.columns = [{ width: 32 }, { width: 18 }];
  freezeHeaderAndFilter(
    expensesSheet,
    expensesHeaderRow,
    expensesSheet.rowCount,
    2,
  );

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildExportFilename(
      "financial-summary",
      context.periodFrom,
      context.periodTo,
      "xlsx",
    ),
  };
}

function pdfTable(
  headers: string[],
  rows: TableCell[][],
  widths?: (string | number)[],
): Content {
  return buildPdfDataTable(headers, rows, widths);
}

function summaryPdfRows(data: FinancialSummaryData): TableCell[][] {
  return buildSummaryMetrics(data).map((metric) => {
    if (metric.kind === "money") {
      return [metric.label, formatExportMoney(metric.value as number)];
    }
    if (metric.kind === "percent") {
      return [metric.label, `${(metric.value as number).toFixed(1)}%`];
    }
    if (metric.kind === "integer") {
      return [
        metric.label,
        (metric.value as number).toLocaleString("en-US"),
      ];
    }
    return [metric.label, String(metric.value)];
  });
}

export async function buildFinancialPdf(
  data: FinancialSummaryData,
  context: ReportExportContext,
): Promise<ExportFileResult> {
  const showEmptyNotice = !hasFinancialActivity(data);
  const monthlyRows = hasMonthlyActivity(data)
    ? data.charts.revenueCogsExpenses.map((row) => [
        row.month,
        formatExportMoney(row.revenue),
        formatExportMoney(row.cogs),
        formatExportMoney(row.expenses),
        formatExportMoney(row.revenue - row.cogs - row.expenses),
      ])
    : [["—", "—", "—", "—", FINANCIAL_EMPTY_NOTICE]];

  const expenseRows =
    data.expenseByCategory.length > 0
      ? data.expenseByCategory.map((row) => [
          row.categoryName,
          formatExportMoney(row.amount),
        ])
      : [["No expenses recorded in this period.", "—"]];

  const content: Content[] = [
    {
      text: `Generated: ${context.generatedAtLabel}`,
      style: "meta",
      margin: [0, 0, 0, showEmptyNotice ? 6 : 12],
    },
  ];

  if (showEmptyNotice) {
    content.push({
      text: FINANCIAL_EMPTY_NOTICE,
      style: "notice",
      margin: [0, 0, 0, 12],
    });
  }

  content.push(
    buildPdfSection(
      "Summary",
      pdfTable(["Metric", "Value"], summaryPdfRows(data), ["*", 120]),
    ),
    buildPdfSection(
      "Profit & Loss",
      pdfTable(
        ["Line", "Amount"],
        [
          ["Revenue", formatExportMoney(data.breakdown.revenue)],
          ["COGS", formatExportMoney(data.breakdown.cogs)],
          ["Gross Profit", formatExportMoney(data.breakdown.grossProfit)],
          ["Expenses", formatExportMoney(data.breakdown.expenses)],
          [
            { text: "Net Profit", bold: true },
            { text: formatExportMoney(data.breakdown.netProfit), bold: true },
          ],
        ],
        ["*", 120],
      ),
    ),
    buildPdfSection(
      "Monthly Breakdown",
      pdfTable(
        ["Month", "Revenue", "COGS", "Expenses", "Net Profit"],
        monthlyRows,
        ["*", "*", "*", "*", "*"],
      ),
    ),
    buildPdfSection(
      "Expenses by Category",
      pdfTable(["Category", "Amount"], expenseRows, ["*", 120]),
    ),
  );

  const doc = buildReportPdfDocument(context, content);

  const buffer = await renderPdf(doc);

  return {
    buffer,
    contentType: "application/pdf",
    filename: buildExportFilename(
      "financial-summary",
      context.periodFrom,
      context.periodTo,
      "pdf",
    ),
  };
}
