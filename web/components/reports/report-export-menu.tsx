"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadReportExport,
  type ReportExportFormat,
  type ReportExportKind,
} from "@/service/reports/export";
import type { ReportQuery } from "@/types/reports/query";
import { useAppStore } from "@/store/app";

interface ReportExportMenuProps {
  report?: ReportExportKind;
  reports?: ReportExportKind[];
  params: ReportQuery;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

const REPORT_LABELS: Record<ReportExportKind, string> = {
  "financial-summary": "Financial Summary",
  "stock-report": "Stock Report",
};

export function ReportExportMenu({
  report,
  reports,
  params,
  disabled = false,
  onBusyChange,
}: ReportExportMenuProps) {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const reportList = reports ?? (report ? [report] : []);

  const exportReport = async (
    kind: ReportExportKind,
    format: ReportExportFormat,
  ) => {
    setBusyKey(`${kind}:${format}`);
    try {
      await downloadReportExport(kind, format, params);
      addToast({
        title: format === "xlsx" ? "Excel export ready" : "PDF export ready",
      });
    } catch (error) {
      addErrorToast({
        title: "Export failed",
        sub: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const busy = busyKey !== null;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {reportList.map((kind, index) => (
          <div key={kind}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {reportList.length > 1 ? (
              <DropdownMenuLabel>{REPORT_LABELS[kind]}</DropdownMenuLabel>
            ) : null}
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void exportReport(kind, "xlsx")}
            >
              <FileSpreadsheet className="size-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onClick={() => void exportReport(kind, "pdf")}
            >
              <FileText className="size-4" />
              PDF (.pdf)
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
