import { cn } from "@/lib/utils";

function SkeletonBar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn("dt-skeleton", className)}
      aria-hidden="true"
      style={style}
    />
  );
}

function KpiCardSkeleton({ tintClass }: { tintClass: string }) {
  return (
    <div className={cn("stat-card stock-report-kpi", tintClass)}>
      <div className="stat-top">
        <SkeletonBar
          style={{ width: 44, height: 44, borderRadius: 6, maxWidth: 44 }}
        />
      </div>
      <SkeletonBar
        style={{ width: "55%", height: 28, maxWidth: 100, marginBottom: 8 }}
      />
      <SkeletonBar style={{ width: "70%", height: 14, maxWidth: 140 }} />
    </div>
  );
}

export function StockReportLoadingSkeleton() {
  return (
    <div className="stock-report" aria-busy="true" aria-label="Loading stock report">
      <div className="stock-report-summary">
        <KpiCardSkeleton tintClass="stock-report-kpi--purchase" />
        <KpiCardSkeleton tintClass="stock-report-kpi--instock" />
        <KpiCardSkeleton tintClass="stock-report-kpi--sales" />
      </div>

      <div className="card stock-report-card">
        <div className="card-head">
          <SkeletonBar style={{ width: 120, height: 16, maxWidth: 120 }} />
          <SkeletonBar style={{ width: 72, height: 14, maxWidth: 72 }} />
        </div>
        <div className="stock-report-table-scroll stock-report-table-scroll--skeleton">
          <SkeletonBar
            style={{
              width: "100%",
              height: 280,
              maxWidth: "none",
              borderRadius: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}
