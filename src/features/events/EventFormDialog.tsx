import { useState, type FormEvent } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { CheckboxField, SelectField, TextAreaField, TextField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { getErrorMessage, getFieldErrors } from '@/services/errors'
import type { Event, EventCreate, EventPaymentMode, EventStatus } from '@/types/api'
import { formatAmountInput, parseRupiahInput } from '@/utils/format'
import { emptyToNull, hasErrors, MAX_AMOUNT, type FieldErrors } from '@/utils/validation'

type Field = 'title' | 'description' | 'event_date' | 'target_amount'

interface FormState {
  title: string
  description: string
  eventDate: string
  targetAmount: string
  status: EventStatus
  isPublic: boolean
  paymentMode: EventPaymentMode
}

function initialState(event?: Event): FormState {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    eventDate: event?.event_date ?? '',
    targetAmount: event?.target_amount != null ? formatAmountInput(String(event.target_amount)) : '',
    status: event?.status ?? 'active',
    isPublic: event?.is_public ?? true,
    paymentMode: event?.payment_mode ?? 'track_status',
  }
}

export function validateEventForm(form: FormState): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const title = form.title.trim()
  if (!title) errors.title = 'Judul acara wajib diisi.'
  else if (title.length > 200) errors.title = 'Judul maksimal 200 karakter.'
  if (form.description.trim().length > 5000) errors.description = 'Deskripsi maksimal 5.000 karakter.'
  if (form.eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate)) {
    errors.event_date = 'Format tanggal tidak valid.'
  }
  if (form.targetAmount) {
    const n = parseRupiahInput(form.targetAmount)
    if (n === null || n > MAX_AMOUNT) errors.target_amount = 'Target dana tidak valid.'
  }
  return errors
}

interface EventFormDialogProps {
  open: boolean
  /** When given, the dialog edits this event; otherwise it creates one. */
  event?: Event
  onClose: () => void
  onSubmit: (body: EventCreate) => Promise<unknown>
  paymentModeLocked?: boolean
}

export function EventFormDialog({ open, event, onClose, onSubmit, paymentModeLocked = false }: EventFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={event ? 'Ubah acara' : 'Buat acara baru'}
      description="Acara adalah kegiatan yang menjadi tujuan pengumpulan iuran atau patungan."
    >
      {/* Remount on open so the form always starts from the latest event data. */}
      {open && <EventForm event={event} paymentModeLocked={paymentModeLocked} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function EventForm({
  event,
  paymentModeLocked,
  onCancel,
  onSubmit,
}: {
  event?: Event
  paymentModeLocked: boolean
  onCancel: () => void
  onSubmit: (body: EventCreate) => Promise<unknown>
}) {
  const [form, setForm] = useState<FormState>(() => initialState(event))
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = validateEventForm(form)
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return

    const body: EventCreate = {
      title: form.title.trim(),
      description: emptyToNull(form.description),
      event_date: form.eventDate || null,
      target_amount: form.targetAmount ? parseRupiahInput(form.targetAmount) : null,
      status: form.status,
      is_public: form.isPublic,
      payment_mode: form.paymentMode,
    }
    setSubmitting(true)
    try {
      await onSubmit(body)
    } catch (err) {
      setErrors(getFieldErrors(err) as FieldErrors<Field>)
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan acara.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Judul acara"
        required
        value={form.title}
        onChange={(e) => update('title', e.target.value)}
        error={errors.title}
        maxLength={200}
        placeholder="contoh: Kado pernikahan Rina & Dimas"
        data-autofocus
      />
      <TextAreaField
        label="Deskripsi"
        value={form.description}
        onChange={(e) => update('description', e.target.value)}
        error={errors.description}
        hint="Opsional. Tampil di halaman publik bila acara publik."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tanggal acara"
          type="date"
          value={form.eventDate}
          onChange={(e) => update('eventDate', e.target.value)}
          error={errors.event_date}
        />
        <AmountField
          label="Target dana (Rp)"
          value={form.targetAmount}
          onChange={(v) => update('targetAmount', v)}
          error={errors.target_amount}
          hint="Opsional. Kosongkan bila tidak ada target."
        />
      </div>
      <SelectField
        label="Status"
        value={form.status}
        onChange={(e) => update('status', e.target.value as EventStatus)}
      >
        <option value="active">Aktif</option>
        <option value="completed">Selesai</option>
      </SelectField>
      <fieldset className="space-y-3" disabled={paymentModeLocked}>
        <legend className="text-sm font-medium text-stone-700">Mode pembayaran</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-stone-200 p-3 has-checked:border-green-700 has-checked:bg-green-50">
          <input type="radio" name="payment_mode" value="paid_only" checked={form.paymentMode === 'paid_only'} onChange={() => update('paymentMode', 'paid_only')} className="mt-1 accent-green-700" />
          <span><span className="block text-sm font-medium text-stone-900">Catat yang sudah lunas saja</span><span className="mt-1 block text-sm text-stone-600">Hanya mencatat peserta yang sudah membayar. Tambah peserta sekaligus mencatat pembayarannya.</span></span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-stone-200 p-3 has-checked:border-green-700 has-checked:bg-green-50">
          <input type="radio" name="payment_mode" value="track_status" checked={form.paymentMode === 'track_status'} onChange={() => update('paymentMode', 'track_status')} className="mt-1 accent-green-700" />
          <span><span className="block text-sm font-medium text-stone-900">Pantau status pembayaran</span><span className="mt-1 block text-sm text-stone-600">Catat peserta dan nominal iuran terlebih dahulu, kemudian perbarui status saat pembayaran diterima.</span></span>
        </label>
        {paymentModeLocked && <p className="text-xs text-stone-500">Mode tidak dapat diubah karena acara sudah memiliki peserta.</p>}
      </fieldset>
      <CheckboxField
        label="Tampilkan di halaman publik"
        hint="Siapa pun yang memiliki tautan dapat melihat nama peserta dan status pembayarannya."
        checked={form.isPublic}
        onChange={(e) => update('isPublic', e.target.checked)}
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          {event ? 'Simpan perubahan' : 'Buat acara'}
        </Button>
      </div>
    </form>
  )
}
