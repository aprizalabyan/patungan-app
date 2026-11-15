import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { PaymentAccountFormDialog } from '@/features/payments/PaymentAccountFormDialog'
import { PaymentAccountInfo } from '@/features/payments/PaymentAccountInfo'
import {
  useCreatePaymentAccount,
  usePaymentAccounts,
  useSetPaymentAccountActive,
  useUpdatePaymentAccount,
} from '@/features/payments/usePayments'
import { getErrorMessage } from '@/services/errors'
import type { PaymentAccount } from '@/types/api'
import { cn } from '@/utils/cn'

export function PaymentAccountsPage() {
  const toast = useToast()
  const accounts = usePaymentAccounts()
  const createAccount = useCreatePaymentAccount()
  const updateAccount = useUpdatePaymentAccount()
  const setActive = useSetPaymentAccountActive()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentAccount | undefined>()
  const [deactivating, setDeactivating] = useState<PaymentAccount | null>(null)

  const items = accounts.data
  const providers = useMemo(() => [...new Set((items ?? []).filter((a) => a.type !== 'cash').map((a) => a.provider_name))].sort(), [items])
  const togglingId = setActive.isPending ? (setActive.variables?.id ?? null) : null

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  async function activate(a: PaymentAccount) {
    try {
      await setActive.mutateAsync({ id: a.id, isActive: true })
      toast.success(`Rekening ${a.provider_name} diaktifkan.`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal mengaktifkan rekening.'))
    }
  }

  const columns: Column<PaymentAccount>[] = [
    {
      key: 'account',
      header: 'Rekening',
      hideMobileLabel: true,
      cell: (a) => (
        <div className={cn(!a.is_active && 'opacity-70')}>
          <PaymentAccountInfo account={a} />
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <Badge tone={a.is_active ? 'green' : 'stone'}>{a.is_active ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Aksi',
      hideMobileLabel: true,
      className: 'md:text-right',
      cell: (a) => (
        <div className="flex flex-wrap gap-2 pt-1 md:justify-end md:pt-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(a)
              setFormOpen(true)
            }}
            aria-label={`Ubah rekening ${a.provider_name} ${a.account_name}`}
          >
            Ubah
          </Button>
          {a.is_active ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-700 hover:bg-red-50"
              onClick={() => setDeactivating(a)}
              aria-label={`Nonaktifkan rekening ${a.provider_name} ${a.account_name}`}
            >
              Nonaktifkan
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              loading={togglingId === a.id}
              disabled={togglingId !== null && togglingId !== a.id}
              onClick={() => void activate(a)}
              aria-label={`Aktifkan rekening ${a.provider_name} ${a.account_name}`}
            >
              Aktifkan
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Rekening"
        description="Rekening bank dan e-wallet untuk menerima pembayaran. Rekening nonaktif tidak bisa dipakai untuk pembayaran baru, tetapi riwayat lama tetap tersimpan."
        actions={<Button onClick={openCreate}>Tambah rekening</Button>}
      />

      <Card>
        {accounts.isPending ? (
          <LoadingState />
        ) : accounts.isError ? (
          <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
        ) : accounts.data.length === 0 ? (
          <EmptyState
            title="Belum ada rekening"
            description="Tambahkan rekening bank atau e-wallet, lalu pilih rekening mana yang tersedia di setiap acara."
            action={<Button onClick={openCreate}>Tambah rekening</Button>}
          />
        ) : (
          <DataTable caption="Daftar rekening pembayaran" columns={columns} rows={accounts.data} rowKey={(a) => a.id} />
        )}
      </Card>

      <PaymentAccountFormDialog
        open={formOpen}
        account={editing}
        providerSuggestions={providers}
        onClose={() => setFormOpen(false)}
        onCreate={async (body) => {
          await createAccount.mutateAsync(body)
          toast.success('Rekening berhasil ditambahkan.')
          setFormOpen(false)
        }}
        onUpdate={async (id, body) => {
          await updateAccount.mutateAsync({ id, body })
          toast.success('Rekening diperbarui.')
          setFormOpen(false)
        }}
      />

      <ConfirmDialog
        open={deactivating !== null}
        title="Nonaktifkan rekening?"
        message={
          deactivating && (
            <>
              Rekening <strong>{deactivating.provider_name}</strong> a.n. {deactivating.account_name} tidak bisa dipilih
              untuk pembayaran baru. Riwayat pembayaran lama tidak berubah dan rekening bisa diaktifkan kembali kapan
              saja.
            </>
          )
        }
        confirmLabel="Nonaktifkan"
        loading={setActive.isPending}
        error={setActive.isError ? getErrorMessage(setActive.error, 'Gagal menonaktifkan rekening.') : null}
        onCancel={() => {
          setDeactivating(null)
          setActive.reset()
        }}
        onConfirm={() => {
          if (!deactivating) return
          setActive.mutate(
            { id: deactivating.id, isActive: false },
            {
              onSuccess: () => {
                toast.success(`Rekening ${deactivating.provider_name} dinonaktifkan.`)
                setDeactivating(null)
              },
            },
          )
        }}
      />
    </>
  )
}
