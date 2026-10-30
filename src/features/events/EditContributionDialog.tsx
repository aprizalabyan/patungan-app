import { useState, type FormEvent } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { getErrorMessage } from '@/services/errors'
import type { Contribution, ContributionUpdate } from '@/types/api'
import { formatAmountInput, parseRupiahInput } from '@/utils/format'
import { emptyToNull, hasErrors, type FieldErrors } from '@/utils/validation'
import { validateAmount } from './AddContributionDialog'

interface EditContributionDialogProps {
  contribution: Contribution | null
  onClose: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}

export function EditContributionDialog({ contribution, onClose, onSubmit }: EditContributionDialogProps) {
  return (
    <Dialog
      open={contribution !== null}
      onClose={onClose}
      title="Ubah iuran"
      description={contribution ? `Peserta: ${contribution.friend.name}` : undefined}
    >
      {contribution && <EditForm contribution={contribution} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function EditForm({
  contribution,
  onCancel,
  onSubmit,
}: {
  contribution: Contribution
  onCancel: () => void
  onSubmit: (id: string, body: ContributionUpdate) => Promise<unknown>
}) {
  const [amount, setAmount] = useState(formatAmountInput(String(contribution.amount)))
  const [notes, setNotes] = useState(contribution.notes ?? '')
  const [errors, setErrors] = useState<FieldErrors<'amount' | 'notes'>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = {
      amount: validateAmount(amount),
      notes: notes.trim().length > 500 ? 'Catatan maksimal 500 karakter.' : undefined,
    }
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return
    setSubmitting(true)
    try {
      // Amount/notes changes never touch payment status on the backend.
      await onSubmit(contribution.id, { amount: parseRupiahInput(amount)!, notes: emptyToNull(notes) })
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <AmountField label="Nominal iuran (Rp)" required value={amount} onChange={setAmount} error={errors.amount} />
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
    </form>
  )
}
