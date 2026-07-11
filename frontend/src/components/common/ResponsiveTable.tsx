import React from 'react';

export interface ResponsiveColumn<T> {
  key: string;
  header: string;
  /** Render function for the cell value */
  render: (item: T) => React.ReactNode;
  /** Hide this column on mobile (keep only in table view) */
  hideOnMobile?: boolean;
  /** Optional CSS class for the header */
  headerClass?: string;
  /** Optional CSS class for the cell */
  cellClass?: string;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  /** Unique key accessor */
  keyExtractor: (item: T) => string;
  /** Title shown above each card on mobile */
  cardTitle?: (item: T) => string;
  /** Empty state message */
  emptyMessage?: string;
  /** Called when a row/card is tapped */
  onRowClick?: (item: T) => void;
}

/**
 * ResponsiveTable — Renders as a table on desktop and as cards on mobile.
 *
 * On `md:` and above, shows a standard HTML table with sortable-style headers.
 * On mobile, each row becomes a card with labeled fields for easy tapping.
 *
 * @example
 * ```tsx
 * <ResponsiveTable
 *   columns={[
 *     { key: 'name', header: 'Nom', render: (u) => u.name },
 *     { key: 'role', header: 'Rôle', render: (u) => <Badge>{u.role}</Badge>, hideOnMobile: true },
 *     { key: 'actions', header: '', render: (u) => <button>Éditer</button> },
 *   ]}
 *   data={users}
 *   keyExtractor={(u) => u.id}
 *   onRowClick={(u) => navigate(u.id)}
 * />
 * ```
 */
export default function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  cardTitle,
  emptyMessage = 'Aucune donnée',
  onRowClick,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile);

  return (
    <>
      {/* ── Desktop table — hidden on small screens ── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/8">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 ${col.headerClass ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`border-b border-white/5 transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-white/[0.03]'
                    : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm text-slate-300 ${col.cellClass ?? ''}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards — only on small screens ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={`rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 transition-all duration-150 ${
              onRowClick
                ? 'active:scale-[0.99] active:bg-white/[0.06]'
                : ''
            }`}
          >
            {/* Card title (optional) */}
            {cardTitle && (
              <div className="mb-3 text-sm font-bold text-white">
                {cardTitle(item)}
              </div>
            )}

            {/* Fields */}
            <div className="flex flex-col gap-2.5">
              {mobileColumns.map((col) => (
                <div key={col.key} className="flex items-start justify-between gap-2">
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                    {col.header}
                  </span>
                  <span className="text-right text-sm text-slate-200">
                    {col.render(item)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
