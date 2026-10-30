import { StatCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { EventSummary } from '@/types/api'
import { formatRupiah } from '@/utils/format'

/** Renders backend-computed totals as-is; nothing here is recalculated on the client. */
export function EventSummaryPanel({ summary }: { summary: EventSummary }) {
  const hasTarget = summary.target_amount !== null && summary.target_amount > 0
  return (
    <section aria-label="Ringkasan keuangan" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Terkumpul"
          value={formatRupiah(summary.total_collected)}
          tone="green"
          hint={hasTarget ? `dari target ${formatRupiah(summary.target_amount!)}` : 'Tanpa target'}
        />
        <StatCard label="Belum masuk" value={formatRupiah(summary.total_pending)} tone="amber" />
        <StatCard label="Sudah bayar" value={summary.paid_count} hint={`dari ${summary.total_participants} peserta`} />
        <StatCard label="Belum bayar" value={summary.pending_count} hint="peserta" />
      </div>
      {summary.progress_percent !== null && (
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <ProgressBar percent={summary.progress_percent} />
          {summary.progress_percent > 100 && (
            <p className="mt-2 text-xs text-stone-500">Dana terkumpul sudah melebihi target.</p>
          )}
        </div>
      )}
    </section>
  )
}
