type LegacyTableSkeletonProps = {
  columns: number;
  rows?: number;
};

type LegacyFormSkeletonProps = {
  fields?: number;
};

export function LegacyTableSkeleton({ columns, rows = 8 }: LegacyTableSkeletonProps) {
  const safeColumns = Math.max(1, Math.trunc(columns));
  const safeRows = Math.max(1, Math.trunc(rows));

  return (
    <>
      {Array.from({ length: safeRows }).map((_, rowIndex) => (
        <tr key={`skeleton-row-${rowIndex}`} className="legacy-skeleton-row" aria-hidden="true">
          {Array.from({ length: safeColumns }).map((__, columnIndex) => (
            <td key={`skeleton-cell-${rowIndex}-${columnIndex}`}>
              <span
                className="legacy-skeleton-line"
                style={{ width: `${80 - ((rowIndex + columnIndex) % 3) * 15}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function LegacyFormSkeleton({ fields = 18 }: LegacyFormSkeletonProps) {
  const safeFields = Math.max(6, Math.trunc(fields));

  return (
    <div className="legacy-grid cols-6" aria-hidden="true">
      {Array.from({ length: safeFields }).map((_, index) => (
        <div key={`form-skeleton-${index}`} className={`legacy-field ${index % 5 === 0 ? "col-span-2" : ""}`}>
          <span className="legacy-skeleton-line legacy-skeleton-label" />
          <span className="legacy-skeleton-line legacy-skeleton-input" />
        </div>
      ))}
    </div>
  );
}

export function LegacyPageSkeleton() {
  return (
    <div className="page-shell min-h-screen px-2 py-2 md:px-3">
      <main className="w-full space-y-2">
        <section className="card p-3" aria-hidden="true">
          <span className="legacy-skeleton-line legacy-skeleton-title" />
          <span className="legacy-skeleton-line legacy-skeleton-subtitle" />
        </section>
        <section className="card p-3" aria-hidden="true">
          <div className="legacy-grid cols-4">
            <span className="legacy-skeleton-line legacy-skeleton-input" />
            <span className="legacy-skeleton-line legacy-skeleton-input" />
            <span className="legacy-skeleton-line legacy-skeleton-input" />
            <span className="legacy-skeleton-line legacy-skeleton-input" />
          </div>
          <div className="legacy-table-wrap mt-3">
            <table className="legacy-table">
              <tbody>
                <LegacyTableSkeleton columns={6} rows={6} />
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
