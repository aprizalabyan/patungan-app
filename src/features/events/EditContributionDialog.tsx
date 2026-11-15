import { useState, type FormEvent } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { getErrorMessage } from '@/services/errors'
import type { Contribution, ContributionUpdate, EventPaymentMode } from '@/types/api'
import { formatAmountInput, formatRupiah, parseRupiahInput } from '@/utils/format'
import { emptyToNull, hasErrors, type FieldErrors } from '@/utils/validation'
import { validateAmount } from './AddContributionDialog'

interface EditContributionDialogProps {
  contribution: Contribution | null
  paymentMode: EventPaymentMode
  onClose: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}

export function EditContributionDialog({ contribution, paymentMode, onClose, onSubmit }: EditContributionDialogProps) {
  return (
    <Dialog
      open={contribution !== null}
      onClose={onClose}
      title="Ubah iuran"
      description={contribution ? `Peserta: ${contribution.friend.name}` : undefined}
    >
      {contribution && <EditForm contribution={contribution} paymentMode={paymentMode} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function EditForm({
  contribution,
  paymentMode,
  onCancel,
  onSubmit,
}: {
  contribution: Contribution
  paymentMode: EventPaymentMode
  onCancel: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}) {
  const locked = contribution.payment_status === 'paid'
  const paidOnly = paymentMode === 'paid_only'
  const amountLocked = locked && !paidOnly
  const [amount, setAmount] = useState(formatAmountInput(String(contribution.amount)))
  const [notes, setNotes] = useState(contribution.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors<'amount' | 'notes'>>({})
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
              <strong>{formatRupiah(confirmingAmount.amount)}</strong>. Status lunas, rekening, dan waktu pembayaran
              akan tetap dipertahankan.
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
