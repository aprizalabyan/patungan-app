import { useMemo } from 'react'
import { Link } from 'react-router'
import { EventStatusBadge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/Button'
import { Card, CardHeader, StatCard } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useAuth } from '@/features/auth/authContext'
import { useAllEvents, useEventSummaries } from '@/features/events/useEvents'
import { formatDate, formatRupiah } from '@/utils/format'

const RECENT_COUNT = 5

export function DashboardPage() {
  const { user } = useAuth()
  const events = useAllEvents()
  const allEvents = useMemo(() => events.data?.items ?? [], [events.data])
  const eventIds = useMemo(() => allEvents.map((e) => e.id), [allEvents])
  const summaries = useEventSummaries(eventIds)

  /**
   * The backend has no dashboard aggregate endpoint, so we combine the
   * backend's per-event summaries — and only once *every* one has loaded, so
   * figures are never derived from a partial set.
   */
  const totals = useMemo(() => {
    if (!events.data || summaries.isPending || summaries.isError) return null
    const active = allEvents.filter((e) => e.status === 'active')
    let participants = 0
    let collected = 0
    let pending = 0
    for (const e of allEvents) {
      const s = summaries.byId.get(e.id)
      if (!s) return null
      if (e.status === 'active') participants += s.total_participants
      collected += s.total_collected
      pending += s.total_pending
    }
    return { activeCount: active.length, participants, collected, pending }
  }, [events.data, allEvents, summaries])

  const recent = allEvents.slice(0, RECENT_COUNT)

  return (
    <>
      <PageHeader
        title={user ? `Halo, ${user.name}` : 'Dasbor'}
        description="Ringkasan seluruh patungan yang Anda kelola."
        actions={
          <Link to="/events?new=1" className={buttonClasses('primary')}>
            Buat acara
          </Link>
        }
      />

      {events.isPending ? (
        <LoadingState />
      ) : events.isError ? (
        <Card>
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        </Card>
      ) : (
        <div className="space-y-6">
          <section aria-label="Ringkasan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaries.isError ? (
              <Card className="col-span-full">
                <ErrorState
                  error={summaries.error}
                  title="Gagal memuat ringkasan keuangan"
                  onRetry={summaries.refetch}
                />
              </Card>
            ) : (
              <>
                <StatCard label="Acara aktif" value={totals ? totals.activeCount : '…'} />
                <StatCard label="Peserta (acara aktif)" value={totals ? totals.participants : '…'} />
                <StatCard
                  label="Total terkumpul"
                  value={totals ? formatRupiah(totals.collected) : '…'}
                  tone="green"
                  hint="Semua acara, hanya yang sudah lunas"
                />
                <StatCard
                  label="Total belum masuk"
                  value={totals ? formatRupiah(totals.pending) : '…'}
                  tone="amber"
                  hint="Semua acara"
                />
              </>
            )}
          </section>

          <Card>
            <CardHeader
              title="Acara terbaru"
              actions={
                <Link to="/events" className="text-sm font-medium text-green-700 hover:underline">
                  Lihat semua
                </Link>
              }
            />
            {recent.length === 0 ? (
              <EmptyState
                title="Belum ada acara"
                description="Buat acara pertama untuk mulai mencatat iuran teman-teman."
                action={
                  <Link to="/events?new=1" className={buttonClasses('primary')}>
                    Buat acara
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {recent.map((e) => {
                  const s = summaries.byId.get(e.id)
                  return (
                    <li key={e.id}>
                      <Link
                        to={`/events/${e.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-stone-900">{e.title}</p>
                          <p className="text-sm text-stone-500">{formatDate(e.event_date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-stone-600 tabular-nums">
                            {s ? formatRupiah(s.total_collected) : '…'}
                          </span>
                          <EventStatusBadge status={e.status} />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
