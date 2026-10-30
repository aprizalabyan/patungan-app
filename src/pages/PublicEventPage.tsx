import { useParams } from 'react-router'
import { EventStatusBadge, PaymentStatusBadge } from '@/components/ui/Badge'
import { Card, CardHeader, StatCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { usePublicEvent, usePublicEventSummary } from '@/features/public/usePublicEvents'
import { isNotFound } from '@/services/errors'
import { formatDate, formatRupiah } from '@/utils/format'

/**
 * Read-only page for friends. Renders only fields from the public API's
 * allow-listed schemas (no amounts per person, phones, notes or timestamps).
 */
export function PublicEventPage() {
  const { eventId = '' } = useParams()
  const event = usePublicEvent(eventId)
  const summary = usePublicEventSummary(eventId)

  if (event.isPending) return <LoadingState />

  if (event.isError) {
    return (
      <Card>
        {isNotFound(event.error) ? (
          <EmptyState
            title="Acara tidak tersedia"
            description="Acara ini tidak ditemukan atau tidak dibagikan secara publik. Hubungi bendahara untuk tautan yang benar."
          />
        ) : (
          <ErrorState error={event.error} onRetry={() => void event.refetch()} />
        )}
      </Card>
    )
  }

  const e = event.data
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          <span>{formatDate(e.event_date)}</span>
          <EventStatusBadge status={e.status} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words text-stone-900">{e.title}</h1>
        {e.description && <p className="mt-2 whitespace-pre-line text-stone-600">{e.description}</p>}
      </div>

      {summary.isPending ? (
        <LoadingState label="Memuat ringkasan…" />
      ) : summary.isError ? (
        <Card>
          <ErrorState error={summary.error} title="Gagal memuat ringkasan" onRetry={() => void summary.refetch()} />
        </Card>
      ) : (
        <section aria-label="Ringkasan dana" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Terkumpul"
              value={formatRupiah(summary.data.total_collected)}
              tone="green"
              hint={summary.data.target_amount ? `dari target ${formatRupiah(summary.data.target_amount)}` : undefined}
            />
            <StatCard
              label="Sudah bayar"
              value={`${summary.data.paid_count} / ${summary.data.total_participants}`}
              hint="peserta"
            />
          </div>
          {summary.data.progress_percent !== null && (
            <Card className="p-4">
              <ProgressBar percent={summary.data.progress_percent} />
            </Card>
          )}
        </section>
      )}

      <Card>
        <CardHeader title="Peserta" description="Status pembayaran diperbarui oleh bendahara." />
        {e.participants.length === 0 ? (
          <EmptyState title="Belum ada peserta" />
        ) : (
          <ul className="divide-y divide-stone-100" aria-label="Daftar peserta">
            {e.participants.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="text-stone-900">{p.name}</span>
                <PaymentStatusBadge status={p.payment_status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
