"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  report: ReportExportKind;
  params: ReportQuery;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

export function ReportExportMenu({
  report,
  params,
  disabled = false,
  onBusyChange,
}: ReportExportMenuProps) {
  const addToast = useAppStore((s) => s.addToast);
  const addErrorToast = useAppStore((s) => s.addErrorToast);
  const [busyFormat, setBusyFormat] = useState<ReportExportFormat | null>(null);

  const exportReport = async (format: ReportExportFormat) => {
    setBusyFormat(format);
    try {
      await downloadReportExport(report, format, params);
      addToast({
        title: format === "xlsx" ? "Excel export ready" : "PDF export ready",
      });
    } catch (error) {
      addErrorToast({
        title: "Export failed",
        sub: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setBusyFormat(null);
    }
  };

  const busy = busyFormat !== null;

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
        <DropdownMenuItem
          disabled={busy}
          onClick={() => void exportReport("xlsx")}
        >
          <FileSpreadsheet className="size-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy}
          onClick={() => void exportReport("pdf")}
        >
          <FileText className="size-4" />
          PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
