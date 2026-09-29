"use client";

import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackupCodesDisplayProps {
  codes: string[];
}

export function BackupCodesDisplay({ codes }: BackupCodesDisplayProps) {
  const copyAll = () => {
    void navigator.clipboard.writeText(codes.join("\n"));
  };

  const downloadTxt = () => {
    const content = [
      "Inventory — Backup Recovery Codes",
      "==================================",
      "Each code can only be used once.",
      "Store them in a safe place.",
      "",
      ...codes,
      "",
      `Generated: ${new Date().toISOString()}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/50 p-4">
        {codes.map((code, i) => (
          <span key={i} className="text-center font-mono text-sm">
            {code}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={copyAll}>
          <Copy className="size-4" />
          Copy all
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={downloadTxt}>
          <Download className="size-4" />
          Download .txt
        </Button>
      </div>
    </div>
  );
}
