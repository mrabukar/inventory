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
        <SkeletonBar style={{ width: 48, height: 16, maxWidth: 48 }} />
      </div>
      <SkeletonBar
        style={{ width: "70%", height: 28, maxWidth: 120, marginBottom: 8 }}
      />
      <SkeletonBar style={{ width: "55%", height: 14, maxWidth: 100 }} />
    </div>
  );
}

function ChartCardSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="card">
      <div className="card-head">
        <SkeletonBar style={{ width: 180, height: 16, maxWidth: 180 }} />
      </div>
      <div className="card-pad">
        <SkeletonBar style={{ width: "100%", height, maxWidth: "none" }} />
      </div>
    </div>
  );
}

function TableCardSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="card">
      <div className="card-head">
        <SkeletonBar style={{ width: 140, height: 16, maxWidth: 140 }} />
        <SkeletonBar style={{ width: 56, height: 14, maxWidth: 56 }} />
      </div>
      <table className="tbl">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={`head-${index}`}>
                <SkeletonBar style={{ width: 64, height: 12, maxWidth: 64 }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="dt-row dt-skeleton-row">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={`cell-${rowIndex}-${colIndex}`}>
                  <span className="dt-skeleton" aria-hidden="true" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="stat-grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 mb-16">
        {Array.from({ length: 10 }).map((_, index) => (
          <StatCardSkeleton key={`stat-${index}`} />
        ))}
      </div>

      <div className="dash-charts mb-16">
        <ChartCardSkeleton height={260} />
        <ChartCardSkeleton height={260} />
      </div>

      <div className="mb-16">
        <ChartCardSkeleton height={260} />
      </div>

      <div className="grid-3 mb-16">
        <ChartCardSkeleton height={180} />
        <ChartCardSkeleton height={180} />
        <ChartCardSkeleton height={180} />
      </div>

      <div className="grid-2 mb-16">
        <ChartCardSkeleton height={240} />
        <TableCardSkeleton columns={5} rows={5} />
      </div>
    </div>
  );
}
