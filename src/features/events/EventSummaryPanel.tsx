import { PaymentAccountTypeBadge } from '@/components/ui/Badge'
import { Card, StatCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { EventPaymentMode, EventSummary } from '@/types/api'
import { formatRupiah } from '@/utils/format'
import { UNKNOWN_ACCOUNT_LABEL } from '@/utils/labels'

/** Renders backend-computed totals as-is; nothing here is recalculated on the client. */
export function EventSummaryPanel({ summary, paymentMode }: { summary: EventSummary; paymentMode: EventPaymentMode }) {
  const hasTarget = summary.target_amount !== null && summary.target_amount > 0
  if (paymentMode === 'paid_only') {
    return (
      <section aria-label="Ringkasan keuangan" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total peserta" value={summary.total_participants} />
          <StatCard label="Total terkumpul" value={formatRupiah(summary.total_received)} tone="green" hint={hasTarget ? `dari target ${formatRupiah(summary.target_amount!)}` : 'Tanpa target'} />
        </div>
        {summary.progress_percent !== null && <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><ProgressBar percent={summary.progress_percent} />{summary.progress_percent > 100 && <p className="mt-2 text-xs text-stone-500">Dana terkumpul sudah melebihi target.</p>}</div>}
        <ReceiptsByAccount summary={summary} />
      </section>
    )
  }
  return (
    <section aria-label="Ringkasan keuangan" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total tagihan" value={formatRupiah(summary.total_contributions)} hint="Jumlah iuran seluruh peserta" />
        <StatCard
          label="Total diterima"
          value={formatRupiah(summary.total_received)}
          tone="green"
          hint={hasTarget ? `dari target ${formatRupiah(summary.target_amount!)}` : 'Tanpa target'}
        />
        <StatCard label="Belum dibayar" value={formatRupiah(summary.total_pending)} tone="amber" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Lunas" value={summary.paid_count} hint={`dari ${summary.total_participants} peserta`} />
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
      <ReceiptsByAccount summary={summary} />
    </section>
  )
}

/** Receipts per account use the account's current identity; the per-payment history keeps snapshots. */
function ReceiptsByAccount({ summary }: { summary: EventSummary }) {
  const rows = summary.payment_accounts
  const showUnassigned = summary.unassigned_total > 0
  return (
    <Card>
      <div className="border-b border-stone-100 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold text-stone-900">Penerimaan per rekening</h2>
      </div>
      {rows.length === 0 && !showUnassigned ? (
        <p className="px-4 py-4 text-sm text-stone-500 sm:px-5">Belum ada rekening yang terhubung ke acara ini.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
              <span className="flex flex-wrap items-center gap-2 font-medium text-stone-900">
                {a.provider_name}
                <PaymentAccountTypeBadge type={a.type} />
              </span>
              <span className="tabular-nums text-stone-900">{formatRupiah(a.total_received)}</span>
            </li>
          ))}
          {showUnassigned && (
            <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
              <span className="font-medium text-stone-700 italic">{UNKNOWN_ACCOUNT_LABEL}</span>
              <span className="tabular-nums text-stone-900">{formatRupiah(summary.unassigned_total)}</span>
            </li>
          )}
        </ul>
      )}
    </Card>
  )
}
