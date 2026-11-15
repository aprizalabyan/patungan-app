import { PaymentStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type { Contribution, EventPaymentMode } from '@/types/api'
import { formatDateTime, formatRupiah } from '@/utils/format'
import { PaymentAccountInfo } from '@/features/payments/PaymentAccountInfo'

interface ContributionsTableProps {
  contributions: Contribution[]
  paymentMode: EventPaymentMode
  /** Opens the dialog that records, shows or cancels the row's payment. */
  onPayments: (c: Contribution) => void
  onEdit: (c: Contribution) => void
  onDelete: (c: Contribution) => void
}

export function ContributionsTable({
  contributions,
  paymentMode,
  onPayments,
  onEdit,
  onDelete,
}: ContributionsTableProps) {
  const columns: Column<Contribution>[] = [
    {
      key: 'name',
      header: 'Nama',
      hideMobileLabel: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-stone-900">
            {c.friend.name}
            {c.friend.nickname && <span className="font-normal text-stone-500"> ({c.friend.nickname})</span>}
          </p>
          {c.notes && <p className="mt-0.5 text-xs wrap-break-word text-stone-500">Catatan: {c.notes}</p>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Iuran',
      className: 'tabular-nums md:text-right whitespace-nowrap',
      cell: (c) => formatRupiah(c.amount),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => <PaymentStatusBadge status={c.payment_status} />,
    },
    {
      key: 'paid_at',
      header: 'Dibayar pada',
      className: 'whitespace-nowrap text-stone-600',
      cell: (c) => (c.payment_status === 'paid' && c.paid_at ? formatDateTime(c.paid_at) : '-'),
    },
    ...(paymentMode === 'paid_only' ? [{
      key: 'account', header: 'Rekening',
      cell: (c: Contribution) => c.payment_account ? <PaymentAccountInfo account={c.payment_account} /> : '-',
    } satisfies Column<Contribution>] : []),
    {
      key: 'actions',
      header: 'Aksi',
      hideMobileLabel: true,
      className: 'md:text-right',
      cell: (c) => (
        <div className="flex w-full flex-wrap gap-2 pt-1 md:justify-end md:pt-0">
          {paymentMode === 'track_status' && <Button
            size="sm"
            variant={c.payment_status === 'paid' ? 'secondary' : 'primary'}
            onClick={() => onPayments(c)}
            aria-label={`${c.payment_status === 'paid' ? 'Lihat pembayaran' : 'Catat pembayaran'} ${c.friend.name}`}
          >
            {c.payment_status === 'paid' ? 'Lihat pembayaran' : 'Catat pembayaran'}
          </Button>}
          <Button size="sm" variant="secondary" onClick={() => onEdit(c)} aria-label={`Ubah iuran ${c.friend.name}`}>
            Ubah
          </Button>
          {paymentMode === 'track_status' && <Button
            size="sm"
            variant="secondary"
            className="text-red-700 hover:bg-red-50"
            onClick={() => onDelete(c)}
            aria-label={`Hapus ${c.friend.name} dari acara`}
          >
            Hapus
          </Button>}
        </div>
      ),
    },
  ]

  const visibleColumns = paymentMode === 'paid_only' ? columns : columns.filter((column) => column.key !== 'account')
  return <DataTable caption="Daftar peserta dan status pembayaran" columns={visibleColumns} rows={contributions} rowKey={(c) => c.id} />
}
