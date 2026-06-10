"use client";

import { useCallback, useMemo, useState } from "react";

import { AuditDetailSheet } from "./components/audit-detail-sheet";
import { AuditTable } from "./components/audit-table";
import { Combobox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryBar } from "@/components/ui/summary-bar";
import { useAuditLogs } from "@/hooks/audit-logs/use-audit-logs";
import { useUsers } from "@/hooks/users/use-users";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getLast7DaysRange } from "@/lib/filters/dates";
import { listAuditLogs } from "@/service/audit-logs/list-audit-logs";
import {
  AUDIT_ACTION_ITEMS,
  type AuditAction,
  type AuditLog,
} from "@/types/audit/audit-log";

export default function AuditPage() {
  // const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const defaultRange = useMemo(() => getLast7DaysRange(), []);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | undefined>();
  const [action, setAction] = useState<AuditAction | undefined>();
  const [fromDate, setFromDate] = useState(defaultRange.fromDate);
  const [toDate, setToDate] = useState(defaultRange.toDate);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useMemo(
    () => ({
      page: pageIndex + 1,
      limit: pageSize,
      search: debouncedSearch || undefined,
      userId: userId || undefined,
      action,
      fromDate,
      toDate,
    }),
    [pageIndex, pageSize, debouncedSearch, userId, action, fromDate, toDate],
  );

  const { data: usersData } = useUsers({ limit: 100 });
  const { data, isPending, isFetching, isError, error } =
    useAuditLogs(listQuery);

  const rows = data?.data ?? [];
  const rowCount = data?.meta.total ?? 0;
  const isLoading = isPending || (isFetching && (data?.data.length ?? 0) === 0);

  const userItems = useMemo(
    () =>
      (usersData?.data ?? []).map((user) => ({
        value: user.id,
        label: user.name,
        keywords: [user.email],
      })),
    [usersData],
  );

  const uniqueActorsOnPage = useMemo(
    () => new Set(rows.map((row) => row.userId)).size,
    [rows],
  );

  const resetPage = () => setPageIndex(0);

  const handleExportAll = useCallback(async () => {
    const limit = 100;
    let page = 1;
    const exported: AuditLog[] = [];
    let totalPages = 1;

    do {
      const response = await listAuditLogs({
        page,
        limit,
        search: debouncedSearch || undefined,
        userId: userId || undefined,
        action,
        fromDate,
        toDate,
      });
      exported.push(...response.data);
      totalPages = response.meta.totalPages;
      page += 1;
    } while (page <= totalPages);

    return exported;
  }, [debouncedSearch, userId, action, fromDate, toDate]);

  const toolbarExtra = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      <DateRangePicker
        fromDate={fromDate}
        toDate={toDate}
        onChange={({ fromDate: nextFrom, toDate: nextTo }) => {
          setFromDate(nextFrom);
          setToDate(nextTo);
          resetPage();
        }}
      />
      <Combobox
        value={userId}
        onValueChange={(value) => {
          setUserId(value);
          resetPage();
        }}
        items={userItems}
        placeholder="All users"
        searchPlaceholder="Search users…"
        emptyText="No users found."
      />
      <Combobox
        value={action}
        onValueChange={(value) => {
          setAction(value as AuditAction | undefined);
          resetPage();
        }}
        items={AUDIT_ACTION_ITEMS}
        placeholder="All actions"
        searchPlaceholder="Search actions…"
        emptyText="No actions found."
      />
    </div>
  );

  return (
    <>
      <PageHeader title="Audit Log" desc="Every action, who did it, and when" />

      {/* <SummaryBar
        items={[
          { k: "Entries in range", v: rowCount },
          { k: "Actors on page", v: uniqueActorsOnPage },
        ]}
      /> */}

      {isError && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error instanceof Error ? error.message : "Failed to load audit log."}
        </div>
      )}

      <AuditTable
        rows={rows}
        rowCount={rowCount}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          resetPage();
        }}
        onPaginationChange={({ pageIndex: nextIndex, pageSize: nextSize }) => {
          setPageIndex(nextIndex);
          setPageSize(nextSize);
        }}
        isLoading={isLoading}
        onExportAll={handleExportAll}
        onView={setSelectedLog}
        toolbarExtra={toolbarExtra}
      />

      {selectedLog && (
        <AuditDetailSheet
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </>
  );
}
