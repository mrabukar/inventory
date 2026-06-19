import ExcelJS from "exceljs";
import type { Content, TableCell } from "pdfmake/interfaces";
import { buildExportFilename, formatExportNumber } from "./export-format.util";
import {
  applyMetaRows,
  applyNoticeRow,
  applyWorksheetTitle,
  freezeHeaderAndFilter,
  setIntegerCell,
  styleTableHeaderRow,
} from "./excel-export.util";
import {
  buildPdfDataTable,
  buildPdfSection,
  buildReportPdfDocument,
} from "./pdf-export.util";
import { renderPdf } from "./pdfmake.util";
import { buildExportMetaRows } from "./report-export-meta.helpers";
import type { ExportFileResult, ReportExportContext } from "./report-export.types";
import {
  buildStockSummaryMetrics,
  hasStockActivity,
  productLabel,
  STOCK_EMPTY_NOTICE,
} from "./stock-export.helpers";

type StockReportData = Awaited<
  ReturnType<import("../reports.service").ReportsService["getStockReport"]>
>;

const COLUMN_COUNT = 4;

function addSheetHeader(
  sheet: ExcelJS.Worksheet,
  context: ReportExportContext,
  showEmptyNotice: boolean,
): void {
  applyWorksheetTitle(
    sheet,
    `${context.reportTitle} — ${context.organizationName}`,
    COLUMN_COUNT,
  );
  sheet.addRow([]);
  applyMetaRows(sheet, buildExportMetaRows(context));
  sheet.addRow([]);
  if (showEmptyNotice) {
    applyNoticeRow(sheet, STOCK_EMPTY_NOTICE, COLUMN_COUNT);
    sheet.addRow([]);
  }
}

function addSummarySheet(
  workbook: ExcelJS.Workbook,
  data: StockReportData,
  context: ReportExportContext,
  showEmptyNotice: boolean,
): void {
  const sheet = workbook.addWorksheet("Summary");
  addSheetHeader(sheet, context, showEmptyNotice);

  const headerRow = sheet.rowCount + 1;
  sheet.addRow(["Metric", "Value"]);
  styleTableHeaderRow(sheet, headerRow, 2);

  for (const metric of buildStockSummaryMetrics(data)) {
    const row = sheet.addRow([metric.label, null]);
    setIntegerCell(row.getCell(2), metric.value);
  }

  sheet.columns = [{ width: 30 }, { width: 18 }];
  freezeHeaderAndFilter(sheet, headerRow, sheet.rowCount, 2);
}

function addProductsSheet(
  workbook: ExcelJS.Workbook,
  data: StockReportData,
  context: ReportExportContext,
  showEmptyNotice: boolean,
): void {
  const sheet = workbook.addWorksheet("By Product");
  addSheetHeader(sheet, context, showEmptyNotice);

  const headerRow = sheet.rowCount + 1;
  sheet.addRow(["Product", "Purchased", "In Stock", "Sold"]);
  styleTableHeaderRow(sheet, headerRow, COLUMN_COUNT);

  if (showEmptyNotice) {
    const emptyRow = sheet.addRow([STOCK_EMPTY_NOTICE, null, null, null]);
    sheet.mergeCells(emptyRow.number, 1, emptyRow.number, COLUMN_COUNT);
  } else {
    for (const row of data.products) {
      const excelRow = sheet.addRow([productLabel(row), null, null, null]);
      setIntegerCell(excelRow.getCell(2), row.purchaseDevices);
      setIntegerCell(excelRow.getCell(3), row.inStock);
      setIntegerCell(excelRow.getCell(4), row.salesDevices);
    }

    const totalsRow = sheet.addRow(["Totals", null, null, null]);
    totalsRow.font = { bold: true };
    setIntegerCell(totalsRow.getCell(2), data.totals.purchaseDevices);
    setIntegerCell(totalsRow.getCell(3), data.totals.inStock);
    setIntegerCell(totalsRow.getCell(4), data.totals.salesDevices);
  }

  sheet.columns = [
    { width: 40 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];
  freezeHeaderAndFilter(sheet, headerRow, sheet.rowCount, COLUMN_COUNT);
}

export async function buildStockExcel(
  data: StockReportData,
  context: ReportExportContext,
): Promise<ExportFileResult> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.organizationName;
  workbook.created = new Date();
  const showEmptyNotice = !hasStockActivity(data);

  addSummarySheet(workbook, data, context, showEmptyNotice);
  addProductsSheet(workbook, data, context, showEmptyNotice);

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return {
    buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: buildExportFilename(
      "stock-report",
      context.periodFrom,
      context.periodTo,
      "xlsx",
    ),
  };
}

function productPdfRows(data: StockReportData): TableCell[][] {
  if (!hasStockActivity(data)) {
    return [[STOCK_EMPTY_NOTICE, "—", "—", "—"]];
  }

  const rows: TableCell[][] = data.products.map((row) => [
    productLabel(row),
    formatExportNumber(row.purchaseDevices),
    formatExportNumber(row.inStock),
    formatExportNumber(row.salesDevices),
  ]);

  rows.push([
    { text: "Totals", bold: true },
    { text: formatExportNumber(data.totals.purchaseDevices), bold: true },
    { text: formatExportNumber(data.totals.inStock), bold: true },
    { text: formatExportNumber(data.totals.salesDevices), bold: true },
  ]);

  return rows;
}

function summaryPdfRows(data: StockReportData): TableCell[][] {
  return buildStockSummaryMetrics(data).map((metric) => [
    metric.label,
    formatExportNumber(metric.value),
  ]);
}

export async function buildStockPdf(
  data: StockReportData,
  context: ReportExportContext,
): Promise<ExportFileResult> {
  const showEmptyNotice = !hasStockActivity(data);

  const content: Content[] = [
    {
      text: `Generated: ${context.generatedAtLabel}`,
      style: "meta",
      margin: [0, 0, 0, showEmptyNotice ? 6 : 12],
    },
  ];

  if (showEmptyNotice) {
    content.push({
      text: STOCK_EMPTY_NOTICE,
      style: "notice",
      margin: [0, 0, 0, 12],
    });
  }

  content.push(
    buildPdfSection(
      "Summary",
      buildPdfDataTable(["Metric", "Units"], summaryPdfRows(data), ["*", 100]),
    ),
    buildPdfSection(
      "By Product",
      buildPdfDataTable(
        ["Product", "Purchased", "In Stock", "Sold"],
        productPdfRows(data),
        ["*", 80, 80, 80],
      ),
    ),
  );

  const doc = buildReportPdfDocument(context, content);

  const buffer = await renderPdf(doc);

  return {
    buffer,
    contentType: "application/pdf",
    filename: buildExportFilename(
      "stock-report",
      context.periodFrom,
      context.periodTo,
      "pdf",
    ),
  };
}
