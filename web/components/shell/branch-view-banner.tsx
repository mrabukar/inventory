"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBranchView } from "@/hooks/branch-view/use-branch-view";

/** Shown above a page while the admin is looking at a credit branch's data. */
export function BranchViewBanner() {
  const view = useBranchView();

  if (!view.onBranchPage || !view.selected) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-l-4 border-b-amber-500/40 border-l-amber-500 bg-amber-500/20 px-[var(--content-padding-x)] py-2.5 text-sm font-medium text-foreground"
    >
      <span className="flex items-center gap-2">
        <Eye className="size-4 shrink-0 text-amber-500" />
        <span>
          Viewing <strong>{view.selected.name}</strong>. This is a read-only
          view of the branch&apos;s data.
        </span>
      </span>
      <Button variant="outline" size="sm" onClick={() => view.select(null)}>
        Back to {view.organizationName}
      </Button>
    </div>
  );
}
