import { useState, type FormEvent } from 'react'
import { PaymentStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField, TextField } from '@/components/ui/FormField'
import { LoadingState } from '@/components/ui/Spinner'
import { InlineError } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage, getFieldErrors } from '@/services/errors'
import type { Contribution, PaymentAccount } from '@/types/api'
import { formatDateTime, formatRupiah, toWibInputValue, wibInputToIso } from '@/utils/format'
import { UNKNOWN_ACCOUNT_LABEL } from '@/utils/labels'
import { emptyToNull, hasErrors, type FieldErrors } from '@/utils/validation'
import { PaymentAccountInfo } from './PaymentAccountInfo'
import {
  useCancelContributionPayment,
  useEventPaymentAccounts,
  useRecordContributionPayment,
} from './usePayments'

const MAX_TEXT = 2000

interface ContributionPaymentDialogProps {
  /** The live row from the participant list, so the dialog follows every refetch. */
  contribution: Contribution | null
  eventId: string
  onClose: () => void
}

/**
 * One contribution has one payment: a pending contribution shows the record form,
 * a paid one shows the payment (account snapshot, date, notes) and the cancel action.
 */
export function ContributionPaymentDialog({ contribution, eventId, onClose }: ContributionPaymentDialogProps) {
  if (!contribution) return null
  return <PaymentDialog key={contribution.id} contribution={contribution} eventId={eventId} onClose={onClose} />
}

function PaymentDialog({
  contribution,
  eventId,
  onClose,
}: {
  contribution: Contribution
  eventId: string
  onClose: () => void
}) {
  const toast = useToast()
  const accounts = useEventPaymentAccounts(eventId)
  const record = useRecordContributionPayment(eventId, contribution.id)
  const cancel = useCancelContributionPayment(eventId, contribution.id)
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()

  const isPaid = contribution.payment_status === 'paid'
  // Only active accounts may receive a new payment; the backend rejects the others.
  const selectable = (accounts.data ?? []).filter((a) => a.is_active)

  function startCancel() {
    setReason('')
    setReasonError(undefined)
    cancel.reset()
    setCancelling(true)
  }

  async function confirmCancel() {
    const trimmed = reason.trim()
    if (trimmed.length > MAX_TEXT) {
      setReasonError(`Alasan maksimal ${MAX_TEXT} karakter.`)
      return
    }
    setReasonError(undefined)
    try {
      await cancel.mutateAsync(trimmed ? { reason: trimmed } : undefined)
      toast.success('Pembayaran dibatalkan. Iuran kembali berstatus belum bayar.')
      setCancelling(false)
      onClose()
    } catch {
      // The message is shown by the confirm dialog through `cancel.error`.
    }
  }

  return (
    <>
      <Dialog
        open={!cancelling}
        onClose={onClose}
        title={isPaid ? 'Pembayaran' : 'Catat pembayaran'}
        description={`Peserta: ${contribution.friend.name}`}
        size="lg"
        footer={
          isPaid ? (
            <>
              <Button variant="danger" onClick={startCancel}>
                Batalkan pembayaran
              </Button>
              <Button variant="secondary" onClick={onClose} autoFocus>
                Tutup
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-3 rounded-lg bg-stone-50 p-3 text-sm">
            <div>
              <dt className="text-stone-500">Nominal tagihan</dt>
              <dd className="mt-1 font-semibold text-stone-900 tabular-nums">{formatRupiah(contribution.amount)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Status</dt>
              <dd className="mt-1">
                <PaymentStatusBadge status={contribution.payment_status} />
              </dd>
            </div>
          </dl>

          {isPaid ? (
            <PaidDetails contribution={contribution} />
          ) : accounts.isPending ? (
            <LoadingState label="Memuat rekening acara…" />
          ) : accounts.isError ? (
            <div className="space-y-2">
              <InlineError message={`Gagal memuat rekening acara. ${getErrorMessage(accounts.error)}`} />
              <Button size="sm" variant="secondary" onClick={() => void accounts.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : (
            <RecordForm
              contribution={contribution}
              accounts={selectable}
              onCancel={onClose}
              onSubmit={async (body) => {
                await record.mutateAsync(body)
                toast.success('Pembayaran dicatat.')
              }}
            />
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={cancelling}
        title="Batalkan pembayaran?"
        message={
          <div className="space-y-3">
            <p>
              Pembayaran <strong>{formatRupiah(contribution.amount)}</strong> dari{' '}
              <strong>{contribution.friend.name}</strong> akan dibatalkan. Iuran kembali berstatus belum bayar dan
              informasi rekening serta tanggal pembayarannya dihapus dari iuran ini.
            </p>
            <TextAreaField
              label="Alasan pembatalan"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={reasonError}
              maxLength={MAX_TEXT}
              hint="Opsional."
              data-autofocus
            />
          </div>
        }
        confirmLabel="Batalkan pembayaran"
        cancelLabel="Kembali"
        loading={cancel.isPending}
        error={cancel.isError ? getErrorMessage(cancel.error, 'Gagal membatalkan pembayaran.') : null}
        onCancel={() => {
          cancel.reset()
          setCancelling(false)
        }}
        onConfirm={() => void confirmCancel()}
      />
    </>
  )
}

/** Account, date and notes come from the contribution (snapshot taken when it was paid). */
function PaidDetails({ contribution }: { contribution: Contribution }) {
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-stone-500">Rekening tujuan</dt>
        <dd className="mt-1">
          {contribution.payment_account ? (
            <PaymentAccountInfo account={contribution.payment_account} />
          ) : (
            <span className="text-stone-600 italic">{UNKNOWN_ACCOUNT_LABEL}</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="text-stone-500">Tanggal pembayaran</dt>
        <dd className="mt-1 font-medium text-stone-900">{formatDateTime(contribution.paid_at)}</dd>
      </div>
      {contribution.payment_notes && (
        <div>
          <dt className="text-stone-500">Catatan pembayaran</dt>
          <dd className="mt-1 break-words text-stone-800">{contribution.payment_notes}</dd>
        </div>
      )}
    </dl>
  )
}

type Field = 'account' | 'paid_at' | 'notes'

function RecordForm({
  contribution,
  accounts,
  onCancel,
  onSubmit,
}: {
  contribution: Contribution
  accounts: PaymentAccount[]
  onCancel: () => void
  onSubmit: (body: { payment_account_id: string; paid_at: string; notes?: string }) => Promise<unknown>
}) {
  const [accountId, setAccountId] = useState(() => (accounts.length === 1 ? accounts[0].id : ''))
  const [paidAt, setPaidAt] = useState(() => toWibInputValue(new Date()))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const paidAtIso = wibInputToIso(paidAt)
    const v: FieldErrors<Field> = {
      account: accountId ? undefined : 'Pilih rekening tujuan.',
      paid_at: paidAtIso ? undefined : 'Waktu pembayaran wajib diisi dengan benar.',
      notes: notes.trim().length > MAX_TEXT ? `Catatan maksimal ${MAX_TEXT} karakter.` : undefined,
    }
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v) || !paidAtIso) return

    setSubmitting(true)
    try {
      // No amount: the payment always equals the bill and the backend takes it from the contribution.
      const trimmedNotes = emptyToNull(notes)
      await onSubmit({
        payment_account_id: accountId,
        paid_at: paidAtIso,
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      })
    } catch (err) {
      const server = getFieldErrors(err)
      if (Object.keys(server).length > 0) {
        setErrors({ account: server.payment_account_id, paid_at: server.paid_at, notes: server.notes })
      }
      setSubmitError(getErrorMessage(err, 'Gagal mencatat pembayaran.'))
    } finally {
      setSubmitting(false)
    }
  }

  const noAccounts = accounts.length === 0

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {noAccounts && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Belum ada rekening aktif untuk acara ini. Atur rekening acara terlebih dahulu sebelum mencatat pembayaran.
        </p>
      )}
      <SelectField
        label="Rekening tujuan"
        required
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        error={errors.account}
        disabled={noAccounts}
        hint="Hanya rekening aktif yang tersedia untuk acara ini."
        autoFocus
      >
        <option value="">Pilih rekening…</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.type === 'cash'
              ? `Tunai — ${a.account_name}`
              : `${a.provider_name} — ${a.account_name} (${a.account_number})`}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Nominal pembayaran"
        value={formatRupiah(contribution.amount)}
        readOnly
        hint="Selalu sama dengan nominal tagihan dan tidak dapat diubah."
      />
      <TextField
        label="Waktu pembayaran (WIB)"
        required
        type="datetime-local"
        value={paidAt}
        onChange={(e) => setPaidAt(e.target.value)}
        error={errors.paid_at}
      />
      <TextAreaField
        label="Catatan"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={errors.notes}
        maxLength={MAX_TEXT}
        hint="Opsional. Hanya terlihat oleh bendahara."
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting} disabled={noAccounts}>
          Catat pembayaran
        </Button>
      </div>
    </form>
  )
}
