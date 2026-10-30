import { Link } from 'react-router'
import { EventStatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Pagination } from '@/components/ui/Pagination'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { usePublicEventsList } from '@/features/public/usePublicEvents'
import { usePageParam } from '@/hooks/usePageParam'
import { formatDate } from '@/utils/format'
import { publicEventPath } from '@/utils/publicUrl'

const PAGE_SIZE = 10

export function PublicEventsPage() {
  const [page, setPage] = usePageParam()
  const events = usePublicEventsList({ page, page_size: PAGE_SIZE })

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">Acara patungan</h1>
      <p className="mb-6 text-sm text-stone-500">Daftar acara yang dibagikan secara publik oleh bendahara.</p>
      <Card>
        {events.isPending ? (
          <LoadingState />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : events.data.items.length === 0 ? (
          <EmptyState title="Belum ada acara publik" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {events.data.items.map((e) => (
              <li key={e.id}>
                <Link
                  to={publicEventPath(e.id)}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-stone-50 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">{e.title}</p>
                    <p className="text-sm text-stone-500">{formatDate(e.event_date)}</p>
                  </div>
                  <EventStatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {events.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={events.data.total} onPageChange={setPage} />
        )}
      </Card>
    </>
  )
}
