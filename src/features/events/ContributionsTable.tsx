import { PaymentStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import type { Contribution } from '@/types/api'
import { formatDateTime, formatRupiah } from '@/utils/format'

interface ContributionsTableProps {
  contributions: Contribution[]
  /** Opens the dialog that records, shows or cancels the row's payment. */
  onPayments: (c: Contribution) => void
  onEdit: (c: Contribution) => void
  onDelete: (c: Contribution) => void
}

export function ContributionsTable({
  contributions,
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
          {c.notes && <p className="mt-0.5 text-xs break-words text-stone-500">Catatan: {c.notes}</p>}
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
    {
      key: 'actions',
      header: 'Aksi',
      hideMobileLabel: true,
      className: 'md:text-right',
      cell: (c) => (
        <div className="flex w-full flex-wrap gap-2 pt-1 md:justify-end md:pt-0">
          <Button
            size="sm"
            variant={c.payment_status === 'paid' ? 'secondary' : 'primary'}
            onClick={() => onPayments(c)}
            aria-label={`${c.payment_status === 'paid' ? 'Lihat pembayaran' : 'Catat pembayaran'} ${c.friend.name}`}
          >
            {c.payment_status === 'paid' ? 'Lihat pembayaran' : 'Catat pembayaran'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(c)} aria-label={`Ubah iuran ${c.friend.name}`}>
            Ubah
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            onClick={() => onDelete(c)}
            aria-label={`Hapus ${c.friend.name} dari acara`}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable caption="Daftar peserta dan status pembayaran" columns={columns} rows={contributions} rowKey={(c) => c.id} />
  )
}
