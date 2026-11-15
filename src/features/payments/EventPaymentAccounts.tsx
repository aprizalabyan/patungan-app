import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState, InlineError } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage } from '@/services/errors'
import type { PaymentAccount } from '@/types/api'
import { cn } from '@/utils/cn'
import { PaymentAccountInfo } from './PaymentAccountInfo'
import { useEventPaymentAccounts, usePaymentAccounts, useReplaceEventPaymentAccounts } from './usePayments'

/** Accounts the treasurer offers for receiving payments in this event, plus the picker dialog. */
export function EventPaymentAccounts({ eventId }: { eventId: string }) {
  const toast = useToast()
  const accounts = useEventPaymentAccounts(eventId)
  const replace = useReplaceEventPaymentAccounts(eventId)
  const [open, setOpen] = useState(false)

  const items = accounts.data ?? []
  const hasInactive = items.some((a) => !a.is_active)

  return (
    <Card>
      <CardHeader
        title="Rekening pembayaran"
        description="Rekening yang bisa dipilih saat mencatat pembayaran di acara ini."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)} disabled={!accounts.data}>
            Atur rekening
          </Button>
        }
      />
      {accounts.isPending ? (
        <LoadingState label="Memuat rekening…" />
      ) : accounts.isError ? (
        <ErrorState error={accounts.error} title="Gagal memuat rekening acara" onRetry={() => void accounts.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada rekening untuk acara ini"
          description="Pilih minimal satu rekening agar pembayaran peserta bisa dicatat."
          action={<Button onClick={() => setOpen(true)}>Atur rekening</Button>}
        />
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {items.map((a) => (
              <li key={a.id} className={cn('px-4 py-3 sm:px-5', !a.is_active && 'opacity-70')}>
                <PaymentAccountInfo account={a} inactive={!a.is_active} />
              </li>
            ))}
          </ul>
          {hasInactive && (
            <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500 sm:px-5">
              Rekening nonaktif tidak bisa dipakai untuk pembayaran baru. Riwayat pembayaran lamanya tetap tersimpan.
            </p>
          )}
        </>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Atur rekening acara"
        description="Pilih rekening yang tersedia untuk menerima pembayaran di acara ini."
      >
        {open && (
          <PickerBody
            current={items}
            onCancel={() => setOpen(false)}
            onSubmit={async (ids) => {
              await replace.mutateAsync(ids)
              toast.success('Rekening acara diperbarui.')
              setOpen(false)
            }}
          />
        )}
      </Dialog>
    </Card>
  )
}

function PickerBody({
  current,
  onCancel,
  onSubmit,
}: {
  current: PaymentAccount[]
  onCancel: () => void
  onSubmit: (ids: string[]) => Promise<unknown>
}) {
  const all = usePaymentAccounts()
  if (all.isPending) return <LoadingState label="Memuat daftar rekening…" />
  if (all.isError) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />
  if (all.data.length === 0) {
    return (
      <EmptyState
        title="Belum ada rekening"
        description="Tambahkan rekening terlebih dahulu di halaman Rekening."
        action={
          <Link to="/payment-accounts" className="font-medium text-green-700 hover:underline">
            Kelola rekening
          </Link>
        }
      />
    )
  }
  return <PickerForm accounts={all.data} current={current} onCancel={onCancel} onSubmit={onSubmit} />
}

function PickerForm({
  accounts,
  current,
  onCancel,
  onSubmit,
}: {
  accounts: PaymentAccount[]
  current: PaymentAccount[]
  onCancel: () => void
  onSubmit: (ids: string[]) => Promise<unknown>
}) {
  const currentIds = new Set(current.map((a) => a.id))
  const activeIds = new Set(accounts.filter((a) => a.is_active).map((a) => a.id))
  // Only active accounts may be selected; the backend rejects inactive ones with 409.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set([...currentIds].filter((id) => activeIds.has(id))),
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const releasedInactive = accounts.filter((a) => !a.is_active && currentIds.has(a.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      // Re-filter at send time so a stale selection can never carry an inactive id.
      await onSubmit([...selected].filter((id) => activeIds.has(id)))
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan rekening acara.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="sr-only">Rekening yang tersedia untuk acara</legend>
        <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
          {accounts.map((a) => (
            <li key={a.id}>
              <label
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 text-sm',
                  a.is_active ? 'cursor-pointer hover:bg-stone-50' : 'cursor-not-allowed opacity-60',
                  selected.has(a.id) && 'bg-green-50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-green-700"
                  checked={selected.has(a.id)}
                  disabled={!a.is_active}
                  onChange={() => toggle(a.id)}
                />
                <span className="min-w-0 flex-1">
                  <PaymentAccountInfo account={a} inactive={!a.is_active} />
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {releasedInactive.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Rekening nonaktif ({releasedInactive.map((a) => a.provider_name).join(', ')}) tidak bisa dipilih dan akan
          dilepas dari acara ini saat disimpan. Riwayat pembayaran yang sudah tercatat tidak dihapus.
        </p>
      )}
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          Simpan rekening
        </Button>
      </div>
    </form>
  )
}
