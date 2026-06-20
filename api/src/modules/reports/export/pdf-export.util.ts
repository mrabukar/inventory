import type { Content, TableCell, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportExportContext } from "./report-export.types";

export const PDF_BRAND_COLOR = "#1E3A5F";
export const PDF_WATERMARK_OPACITY = 0.08;
export const PDF_WATERMARK_WIDTH_RATIO = 0.5;

export const PDF_BASE_STYLES: TDocumentDefinitions["styles"] = {
  headerTitle: { fontSize: 13, bold: true, color: PDF_BRAND_COLOR },
  headerSubtitle: {
    fontSize: 10,
    bold: true,
    color: PDF_BRAND_COLOR,
    margin: [0, 2, 0, 2],
  },
  headerMeta: { fontSize: 8, color: "#555555" },
  meta: { fontSize: 9, color: "#444444" },
  notice: { fontSize: 10, italics: true, color: "#666666" },
  section: {
    fontSize: 11,
    bold: true,
    color: PDF_BRAND_COLOR,
    margin: [0, 4, 0, 8],
  },
};

export function buildPdfRepeatingHeader(
  context: ReportExportContext,
): TDocumentDefinitions["header"] {
  return () => {
    const metaLines: Content[] = [
      {
        text: `${context.periodFrom} to ${context.periodTo}`,
        style: "headerMeta",
      },
      {
        text: `Store: ${context.storeName ?? "All stores"}`,
        style: "headerMeta",
      },
    ];

    if (context.categoryName) {
      metaLines.push({
        text: `Category: ${context.categoryName}`,
        style: "headerMeta",
      });
    }

    const titleStack: Content = {
      stack: [
        { text: context.organizationName, style: "headerTitle" },
        { text: context.reportTitle, style: "headerSubtitle" },
        ...metaLines,
      ],
      margin: [context.logoDataUrl ? 10 : 0, 0, 0, 0],
    };

    if (context.logoDataUrl) {
      return {
        columns: [
          { image: context.logoDataUrl, width: 52, margin: [0, 2, 0, 0] },
          titleStack,
        ],
        margin: [40, 24, 40, 8],
      };
    }

    return {
      ...titleStack,
      margin: [40, 24, 40, 8],
    };
  };
}

export function buildPdfFooter(
  context: ReportExportContext,
): TDocumentDefinitions["footer"] {
  return (currentPage, pageCount) => ({
    columns: [
      { text: context.organizationName, alignment: "left", fontSize: 8 },
      {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right",
        fontSize: 8,
      },
    ],
    margin: [40, 0, 40, 16],
    color: "#666666",
  });
}

export function buildPdfDataTable(
  headers: string[],
  rows: TableCell[][],
  widths?: (string | number)[],
  alignment?: "left" | "center" | "right",
): Content {
  const withAlignment = (cell: TableCell): TableCell => {
    if (!alignment) {
      return cell;
    }
    if (typeof cell === "object" && cell !== null && !Array.isArray(cell)) {
      return { ...cell, alignment } as TableCell;
    }
    return { text: cell ?? "", alignment };
  };

  const headerRow = alignment
    ? headers.map((header) => ({ text: header, bold: true, alignment }))
    : headers;
  const body = alignment
    ? rows.map((row) => row.map((cell) => withAlignment(cell)))
    : rows;

  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: widths ?? headers.map(() => "*"),
      body: [headerRow, ...body],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0,
      hLineColor: () => "#D0D7E2",
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 10],
  };
}

/** Keep a section heading and its table on the same page when they fit together. */
export function buildPdfSection(title: string, table: Content): Content {
  return {
    unbreakable: true,
    stack: [{ text: title, style: "section" }, table],
  };
}

export function buildPdfWatermarkBackground(
  context: ReportExportContext,
): TDocumentDefinitions["background"] {
  const logoDataUrl = context.logoDataUrl;
  if (!logoDataUrl) {
    return undefined;
  }

  return (_currentPage, pageSize) => {
    const width = pageSize.width * PDF_WATERMARK_WIDTH_RATIO;
    const aspectRatio = context.logoAspectRatio ?? 1;
    const height = width / aspectRatio;

    return {
      image: logoDataUrl,
      width,
      height,
      opacity: PDF_WATERMARK_OPACITY,
      absolutePosition: {
        x: (pageSize.width - width) / 2,
        y: (pageSize.height - height) / 2,
      },
    };
  };
}

export function buildReportPdfDocument(
  context: ReportExportContext,
  content: Content[],
): TDocumentDefinitions {
  return {
    pageOrientation: "landscape",
    pageMargins: [40, 92, 40, 48],
    defaultStyle: { font: "Roboto", fontSize: 10 },
    header: buildPdfRepeatingHeader(context),
    background: buildPdfWatermarkBackground(context),
    styles: PDF_BASE_STYLES,
    footer: buildPdfFooter(context),
    content,
  };
}
