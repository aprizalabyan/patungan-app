import { useState, type FormEvent } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { SelectField, TextAreaField } from '@/components/ui/FormField'
import { ErrorState, InlineError } from '@/components/ui/States'
import { LoadingState } from '@/components/ui/Spinner'
import { useEventPaymentAccounts } from '@/features/payments/usePayments'
import { getErrorMessage } from '@/services/errors'
import type { Contribution, ContributionUpdate, EventPaymentMode, PaymentAccountSnapshot } from '@/types/api'
import { formatAmountInput, formatRupiah, parseRupiahInput } from '@/utils/format'
import { emptyToNull, hasErrors, type FieldErrors } from '@/utils/validation'
import { validateAmount } from './AddContributionDialog'

interface EditContributionDialogProps {
  contribution: Contribution | null
  eventId: string
  paymentMode: EventPaymentMode
  onClose: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}

export function EditContributionDialog({ contribution, eventId, paymentMode, onClose, onSubmit }: EditContributionDialogProps) {
  return (
    <Dialog
      open={contribution !== null}
      onClose={onClose}
      title="Ubah iuran"
      description={contribution ? `Peserta: ${contribution.friend.name}` : undefined}
    >
      {contribution && <EditForm contribution={contribution} eventId={eventId} paymentMode={paymentMode} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function EditForm({
  contribution,
  eventId,
  paymentMode,
  onCancel,
  onSubmit,
}: {
  contribution: Contribution
  eventId: string
  paymentMode: EventPaymentMode
  onCancel: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}) {
  const locked = contribution.payment_status === 'paid'
  const paidOnly = paymentMode === 'paid_only'
  const editablePaidOnly = paidOnly && locked
  const amountLocked = locked && !paidOnly
  const accounts = useEventPaymentAccounts(eventId, editablePaidOnly)
  const [amount, setAmount] = useState(formatAmountInput(String(contribution.amount)))
  const [accountId, setAccountId] = useState(contribution.payment_account?.id ?? '')
  const [notes, setNotes] = useState(contribution.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors<'amount' | 'notes' | 'payment_account_id'>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingAmount, setConfirmingAmount] = useState<ContributionUpdate | null>(null)

  async function saveChanges(changes: ContributionUpdate) {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit(contribution.id, changes)
      onCancel()
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = {
      amount: amountLocked ? undefined : validateAmount(amount),
      notes: notes.trim().length > 500 ? 'Catatan maksimal 500 karakter.' : undefined,
    }
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return
    // Send only changed fields. The backend preserves payment status and metadata when
    // changing amount in paid_only; track_status paid amounts stay locked until cancellation.
    const changes: ContributionUpdate = {}
    const newAmount = parseRupiahInput(amount)!
    if (!amountLocked && newAmount !== contribution.amount) changes.amount = newAmount
    if (editablePaidOnly && accountId && accountId !== contribution.payment_account?.id) {
      changes.payment_account_id = accountId
    }
    if (emptyToNull(notes) !== contribution.notes) changes.notes = emptyToNull(notes)
    if (Object.keys(changes).length === 0) {
      onCancel()
      return
    }
    if (locked && paidOnly && changes.amount !== undefined) {
      setConfirmingAmount(changes)
      return
    }
    await saveChanges(changes)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <AmountField
        label="Nominal iuran (Rp)"
        required
        value={amount}
        onChange={setAmount}
        error={errors.amount}
        disabled={amountLocked}
        hint={
          amountLocked
            ? 'Nominal terkunci karena iuran sudah dibayar. Batalkan pembayaran terlebih dahulu untuk mengubahnya.'
            : locked && paidOnly
              ? 'Mengubah nominal tidak membatalkan pembayaran atau mengubah rekening dan waktu pembayaran.'
            : undefined
        }
      />
      {editablePaidOnly && (accounts.isPending ? (
        <LoadingState label="Memuat rekening acara…" />
      ) : accounts.isError ? (
        <ErrorState error={accounts.error} title="Gagal memuat rekening acara" onRetry={() => void accounts.refetch()} />
      ) : (
        <SelectField
          label="Rekening tujuan"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          error={errors.payment_account_id}
          hint="Mengubah rekening tidak mengubah status atau waktu pembayaran."
        >
          <option value="">Pilih rekening</option>
          {contribution.payment_account && !accounts.data?.some((account) => account.id === contribution.payment_account?.id && account.is_active) && (
            <option value={contribution.payment_account.id}>{accountOptionLabel(contribution.payment_account)} (rekening saat ini)</option>
          )}
          {(accounts.data ?? []).filter((account) => account.is_active).map((account) => (
            <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
          ))}
        </SelectField>
      ))}
      <TextAreaField
        label="Catatan"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={errors.notes}
        maxLength={500}
        hint="Hanya terlihat oleh bendahara."
        data-autofocus
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          Simpan
        </Button>
      </div>
      <ConfirmDialog
        open={confirmingAmount !== null}
        title="Konfirmasi perubahan nominal?"
        message={
          confirmingAmount?.amount !== undefined && (
            <p>
              Nominal iuran <strong>{formatRupiah(contribution.amount)}</strong> akan diubah menjadi{' '}
              <strong>{formatRupiah(confirmingAmount.amount)}</strong>. Status lunas dan waktu pembayaran akan tetap
              dipertahankan{confirmingAmount.payment_account_id ? ', dan rekening tujuan akan diperbarui.' : '; rekening tidak berubah.'}
            </p>
          )
        }
        confirmLabel="Simpan perubahan"
        cancelLabel="Kembali"
        tone="primary"
        loading={submitting}
        error={submitError}
        onCancel={() => {
          setConfirmingAmount(null)
          setSubmitError(null)
        }}
        onConfirm={() => {
          if (confirmingAmount) void saveChanges(confirmingAmount)
        }}
      />
    </form>
  )
}

function accountOptionLabel(account: PaymentAccountSnapshot) {
  return account.type === 'cash'
    ? `Tunai — ${account.account_name}`
    : `${account.provider_name} — ${account.account_name} (${account.account_number ?? ''})`
}
