import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { getErrorMessage, getFieldErrors } from '@/services/errors'
import type { Friend, FriendCreate } from '@/types/api'
import { emptyToNull, hasErrors, isValidPhone, type FieldErrors } from '@/utils/validation'

type Field = 'name' | 'nickname' | 'phone'

interface FormState {
  name: string
  nickname: string
  phone: string
}

export function validateFriendForm(form: FormState): FieldErrors<Field> {
  const errors: FieldErrors<Field> = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Nama wajib diisi.'
  else if (name.length > 120) errors.name = 'Nama maksimal 120 karakter.'
  if (form.nickname.trim().length > 60) errors.nickname = 'Nama panggilan maksimal 60 karakter.'
  if (form.phone.trim() && !isValidPhone(form.phone)) {
    errors.phone = 'Nomor telepon tidak valid. Gunakan angka, spasi, tanda -, ( ) dan awalan + bila perlu.'
  }
  return errors
}

interface FriendFormDialogProps {
  open: boolean
  friend?: Friend
  onClose: () => void
  onSubmit: (body: FriendCreate) => Promise<unknown>
}

export function FriendFormDialog({ open, friend, onClose, onSubmit }: FriendFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={friend ? 'Ubah data teman' : 'Tambah teman'}>
      {open && <FriendForm friend={friend} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function FriendForm({
  friend,
  onCancel,
  onSubmit,
}: {
  friend?: Friend
  onCancel: () => void
  onSubmit: (body: FriendCreate) => Promise<unknown>
}) {
  const [form, setForm] = useState<FormState>({
    name: friend?.name ?? '',
    nickname: friend?.nickname ?? '',
    phone: friend?.phone ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = validateFriendForm(form)
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: form.name.trim(),
        nickname: emptyToNull(form.nickname),
        phone: emptyToNull(form.phone),
      })
    } catch (err) {
      setErrors(getFieldErrors(err) as FieldErrors<Field>)
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan data teman.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Nama lengkap"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        error={errors.name}
        maxLength={120}
        autoComplete="off"
        data-autofocus
      />
      <TextField
        label="Nama panggilan"
        value={form.nickname}
        onChange={(e) => setForm({ ...form, nickname: e.target.value })}
        error={errors.nickname}
        maxLength={60}
        autoComplete="off"
        hint="Opsional."
      />
      <TextField
        label="Nomor telepon"
        type="tel"
        inputMode="tel"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        error={errors.phone}
        maxLength={30}
        autoComplete="off"
        placeholder="contoh: +62 812-3456-7890"
        hint="Opsional. Hanya terlihat oleh bendahara."
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          {friend ? 'Simpan perubahan' : 'Tambah teman'}
        </Button>
      </div>
    </form>
  )
}
