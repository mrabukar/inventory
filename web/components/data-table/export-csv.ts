import type { ColumnDef } from "@tanstack/react-table";

function escapeCsvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function getExportValue<TData>(
  row: TData,
  column: ColumnDef<TData>,
): unknown {
  const meta = column.meta as
    | { exportValue?: (row: TData) => unknown }
    | undefined;

  if (meta?.exportValue) return meta.exportValue(row);

  if ("accessorFn" in column && column.accessorFn) {
    return column.accessorFn(row, 0);
  }

  if ("accessorKey" in column && column.accessorKey) {
    return row[column.accessorKey as keyof TData];
  }

  return "";
}

function getExportHeader<TData>(column: ColumnDef<TData>): string {
  const meta = column.meta as { label?: string } | undefined;
  if (meta?.label) return meta.label;
  if (typeof column.header === "string") return column.header;
  return column.id ?? "Column";
}

export function getExportableColumns<TData>(
  columns: ColumnDef<TData>[],
): ColumnDef<TData>[] {
  return columns.filter((column) => {
    if (column.id === "select" || column.id === "actions") return false;
    const meta = column.meta as { export?: boolean } | undefined;
    return meta?.export !== false;
  });
}

export function exportRowsToCsv<TData>(
  rows: TData[],
  columns: ColumnDef<TData>[],
  filename: string,
): void {
  const exportable = getExportableColumns(columns);
  const headers = exportable.map(getExportHeader);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) =>
      exportable
        .map((column) => escapeCsvCell(getExportValue(row, column)))
        .join(","),
    ),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
