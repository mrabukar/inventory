"use client";

import { Button } from "@/components/ui/button";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import {
  auditActionColor,
  buildAuditDiff,
  formatAuditEntity,
  formatAuditSummary,
  formatAuditTimestamp,
  type AuditLog,
} from "@/types/audit/audit-log";

interface AuditDetailSheetProps {
  log: AuditLog;
  onClose: () => void;
}

export function AuditDetailSheet({ log, onClose }: AuditDetailSheetProps) {
  const lines = buildAuditDiff(log.oldValue, log.newValue);
  const isCreate = log.oldValue == null;
  const isDelete = log.newValue == null;

  const meta = [
    { key: "Timestamp", value: formatAuditTimestamp(log.createdAt) },
    {
      key: "Entity",
      value: <span className="num">{formatAuditEntity(log)}</span>,
    },
    {
      key: "User",
      value: (
        <>
          <span className="strong">{log.user.name}</span>
          &nbsp;
          <RoleBadge role={log.user.role} />
        </>
      ),
    },
    {
      key: "Action",
      value: (
        <Badge color={auditActionColor(log.action) as never}>{log.action}</Badge>
      ),
    },
  ];

  return (
    <Sheet
      title="Audit entry"
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Badge color={auditActionColor(log.action) as never}>{log.action}</Badge>
        <span className="num audit-entity">{formatAuditEntity(log)}</span>
      </div>
      <p className="audit-sum" style={{ marginBottom: 20 }}>
        {formatAuditSummary(log)}
      </p>

      <div className="audit-meta" style={{ marginBottom: 20 }}>
        {meta.map((item) => (
          <div className="audit-m" key={item.key}>
            <div className="audit-mk">{item.key}</div>
            <div className="audit-mv">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="diff-head">
        <span className="dh-label">
          {isCreate ? "Record created" : isDelete ? "Record deleted" : "Field changes"}
        </span>
        <span className="diff-legend">
          <span>
            <i className="add" />
            added
          </span>
          {!isCreate && (
            <span>
              <i className="rem" />
              removed
            </span>
          )}
        </span>
      </div>
      <div className="diff">
        {lines.map((line, index) => (
          <div
            className={`dl ${line.kind === "+" ? "add" : line.kind === "-" ? "rem" : ""}`}
            key={index}
          >
            <span className="dg">
              {line.kind === "+" ? "+" : line.kind === "-" ? "−" : " "}
            </span>
            <span className="dc">{line.text}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
