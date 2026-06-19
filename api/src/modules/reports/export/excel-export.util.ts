import ExcelJS from "exceljs";

export const EXCEL_CURRENCY_FORMAT = '"$"#,##0.00';
export const EXCEL_INTEGER_FORMAT = "#,##0";
export const EXCEL_PERCENT_FORMAT = "0.0%";

export const EXCEL_HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E3A5F" },
};

export const EXCEL_HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
};

export const EXCEL_TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  size: 14,
  color: { argb: "FF1E3A5F" },
};

export const EXCEL_META_LABEL_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF444444" },
};

export const EXCEL_NOTICE_FONT: Partial<ExcelJS.Font> = {
  italic: true,
  color: { argb: "FF666666" },
};

export function applyWorksheetTitle(
  sheet: ExcelJS.Worksheet,
  title: string,
  columnCount: number,
): number {
  const row = sheet.addRow([title]);
  row.getCell(1).font = EXCEL_TITLE_FONT;
  if (columnCount > 1) {
    sheet.mergeCells(row.number, 1, row.number, columnCount);
  }
  return row.number;
}

export function applyMetaRows(
  sheet: ExcelJS.Worksheet,
  rows: Array<[string, string]>,
): void {
  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = EXCEL_META_LABEL_FONT;
  }
}

export function applyNoticeRow(
  sheet: ExcelJS.Worksheet,
  message: string,
  columnCount: number,
): void {
  const row = sheet.addRow([message]);
  row.getCell(1).font = EXCEL_NOTICE_FONT;
  if (columnCount > 1) {
    sheet.mergeCells(row.number, 1, row.number, columnCount);
  }
}

export function styleTableHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnCount: number,
): void {
  const row = sheet.getRow(rowNumber);
  row.font = EXCEL_HEADER_FONT;
  row.alignment = { vertical: "middle" };
  for (let col = 1; col <= columnCount; col += 1) {
    row.getCell(col).fill = EXCEL_HEADER_FILL;
  }
  row.height = 20;
}

export function setCurrencyCell(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = EXCEL_CURRENCY_FORMAT;
}

export function setIntegerCell(cell: ExcelJS.Cell, value: number): void {
  cell.value = value;
  cell.numFmt = EXCEL_INTEGER_FORMAT;
}

export function setPercentCell(cell: ExcelJS.Cell, value: number): void {
  cell.value = value / 100;
  cell.numFmt = EXCEL_PERCENT_FORMAT;
}

export function freezeHeaderAndFilter(
  sheet: ExcelJS.Worksheet,
  headerRow: number,
  lastDataRow: number,
  columnCount: number,
): void {
  sheet.views = [{ state: "frozen", ySplit: headerRow, activeCell: `A${headerRow + 1}` }];
  if (lastDataRow >= headerRow) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: lastDataRow, column: columnCount },
    };
  }
}
