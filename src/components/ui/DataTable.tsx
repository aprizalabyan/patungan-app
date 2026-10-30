import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  /** Hide the label prefix on mobile (e.g. for the primary/title cell or actions). */
  hideMobileLabel?: boolean
}

interface DataTableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
}

/**
 * A single semantic table that reflows into stacked cards below the `md`
 * breakpoint; each cell shows its column header as a label on mobile.
 */
export function DataTable<T>({ caption, columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <table className="w-full text-sm max-md:block">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium tracking-wide text-stone-500 uppercase max-md:hidden">
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={cn('px-4 py-3', c.className)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-stone-100 max-md:block">
        {rows.map((row) => (
          <tr key={rowKey(row)} className="align-middle max-md:block max-md:space-y-1.5 max-md:px-4 max-md:py-3">
            {columns.map((c) => (
              <td
                key={c.key}
                data-label={c.hideMobileLabel ? undefined : c.header}
                className={cn(
                  'px-4 py-3 max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:p-0',
                  !c.hideMobileLabel &&
                    'max-md:before:text-xs max-md:before:text-stone-500 max-md:before:content-[attr(data-label)]',
                  c.className,
                )}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
