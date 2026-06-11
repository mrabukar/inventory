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

function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <SkeletonBar
          style={{ width: 40, height: 40, borderRadius: 9999, maxWidth: 40 }}
        />
      </div>
      <SkeletonBar
        style={{ width: "70%", height: 28, maxWidth: 120, marginBottom: 8 }}
      />
      <SkeletonBar style={{ width: "55%", height: 14, maxWidth: 100 }} />
    </div>
  );
}

function PnlBreakdownSkeleton() {
  return (
    <div className="card card-pad">
      <SkeletonBar
        style={{ width: 140, height: 16, maxWidth: 140, marginBottom: 14 }}
      />
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={`pnl-row-${index}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "7px 0",
          }}
        >
          <SkeletonBar
            style={{ width: 180, height: 14, maxWidth: 180, flexShrink: 0 }}
          />
          <SkeletonBar style={{ flex: 1, height: 14, maxWidth: "none" }} />
          <SkeletonBar
            style={{ width: 90, height: 14, maxWidth: 90, flexShrink: 0 }}
          />
        </div>
      ))}
    </div>
  );
}

function ChartCardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="card">
      <div className="card-head">
        <SkeletonBar style={{ width: 220, height: 16, maxWidth: 220 }} />
      </div>
      <div className="card-pad">
        <SkeletonBar style={{ width: "100%", height, maxWidth: "none" }} />
      </div>
    </div>
  );
}

export function FinancialLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading financial summary">
      <div className="stat-grid grid-4 mb-16">
        {Array.from({ length: 7 }).map((_, index) => (
          <StatCardSkeleton key={`stat-${index}`} />
        ))}
      </div>

      <div className="mb-16">
        <PnlBreakdownSkeleton />
      </div>

      <div className="grid-2">
        <ChartCardSkeleton height={260} />
        <ChartCardSkeleton height={260} />
      </div>
    </div>
  );
}
