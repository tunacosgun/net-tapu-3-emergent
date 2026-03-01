import { type ReactNode } from 'react';
import { EmptyState } from './empty-state';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Sonuç bulunamadı.',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted-foreground)]">
            {columns.map((col) => (
              <th key={col.header} className={`pb-2 pr-4 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={keyExtractor(row)} className="border-b border-[var(--border)]">
              {columns.map((col) => (
                <td key={col.header} className={`py-3 pr-4 ${col.className ?? ''}`}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
