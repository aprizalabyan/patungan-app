import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField, TextField } from '@/components/ui/FormField'
import { Spinner } from '@/components/ui/Spinner'
import { InlineError } from '@/components/ui/States'
import { useFriendsList } from '@/features/friends/useFriends'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { getErrorMessage } from '@/services/errors'
import type { ContributionCreate } from '@/types/api'
import { cn } from '@/utils/cn'
import { parseRupiahInput } from '@/utils/format'
import { emptyToNull, hasErrors, MAX_AMOUNT, type FieldErrors } from '@/utils/validation'

type Field = 'friend' | 'amount' | 'notes'

export function validateAmount(raw: string): string | undefined {
  const n = parseRupiahInput(raw)
  if (n === null) return 'Nominal iuran wajib diisi.'
  if (n <= 0) return 'Nominal iuran harus lebih dari Rp0.'
  if (n > MAX_AMOUNT) return 'Nominal iuran terlalu besar.'
  return undefined
}

interface AddContributionDialogProps {
  open: boolean
  onClose: () => void
  /** Friends already in this event (from the loaded participant list); the backend still enforces uniqueness. */
  existingFriendIds: Set<string>
  onSubmit: (body: ContributionCreate) => Promise<unknown>
}

export function AddContributionDialog({ open, onClose, existingFriendIds, onSubmit }: AddContributionDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Tambah peserta"
      description="Pilih teman dari daftar teman, lalu tentukan nominal iurannya. Status awal: belum bayar."
    >
      {open && <AddContributionForm existingFriendIds={existingFriendIds} onCancel={onClose} onSubmit={onSubmit} />}
    </Dialog>
  )
}

function AddContributionForm({
  existingFriendIds,
  onCancel,
  onSubmit,
}: {
  existingFriendIds: Set<string>
  onCancel: () => void
  onSubmit: (body: ContributionCreate) => Promise<unknown>
}) {
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search.trim(), 300)
  const friends = useFriendsList({ search: debounced || undefined, page: 1, page_size: 20 })
  const [friendId, setFriendId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v: FieldErrors<Field> = {
      friend: friendId ? undefined : 'Pilih satu teman.',
      amount: validateAmount(amount),
      notes: notes.trim().length > 500 ? 'Catatan maksimal 500 karakter.' : undefined,
    }
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v) || !friendId) return
    setSubmitting(true)
    try {
      await onSubmit({ friend_id: friendId, amount: parseRupiahInput(amount)!, notes: emptyToNull(notes) })
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Gagal menambahkan peserta.'))
    } finally {
      setSubmitting(false)
    }
  }

  const items = friends.data?.items ?? []

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-stone-700">
          Teman <span className="text-red-600" aria-hidden="true">*</span>
        </legend>
        <TextField
          label={<span className="sr-only">Cari teman</span>}
          type="search"
          placeholder="Cari nama atau panggilan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          data-autofocus
        />
        <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200" aria-busy={friends.isFetching}>
          {friends.isPending ? (
            <div className="flex items-center gap-2 p-3 text-sm text-stone-500">
              <Spinner className="size-4" /> Memuat daftar teman…
            </div>
          ) : friends.isError ? (
            <p className="p-3 text-sm text-red-700">{getErrorMessage(friends.error)}</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-stone-500">
              {debounced ? 'Tidak ada teman yang cocok.' : 'Belum ada teman.'}{' '}
              <Link to="/friends" className="font-medium text-green-700 underline">
                Kelola daftar teman
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {items.map((f) => {
                const already = existingFriendIds.has(f.id)
                return (
                  <li key={f.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50',
                        already && 'cursor-not-allowed opacity-60',
                        friendId === f.id && 'bg-green-50',
                      )}
                    >
                      <input
                        type="radio"
                        name="friend"
                        value={f.id}
                        checked={friendId === f.id}
                        disabled={already}
                        onChange={() => setFriendId(f.id)}
                        className="accent-green-700"
                      />
                      <span className="flex-1">
                        <span className="font-medium text-stone-900">{f.name}</span>
                        {f.nickname && <span className="text-stone-500"> ({f.nickname})</span>}
                      </span>
                      {already && <span className="text-xs text-stone-500">Sudah terdaftar</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {friends.data && friends.data.total > items.length && (
          <p className="text-xs text-stone-500">
            Menampilkan {items.length} dari {friends.data.total} teman. Persempit dengan pencarian.
          </p>
        )}
        {errors.friend && <p className="text-sm text-red-600">{errors.friend}</p>}
      </fieldset>

      <AmountField label="Nominal iuran (Rp)" required value={amount} onChange={setAmount} error={errors.amount} />
      <TextAreaField
        label="Catatan"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        error={errors.notes}
        maxLength={500}
        hint="Opsional. Hanya terlihat oleh bendahara."
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          Tambah peserta
        </Button>
      </div>
    </form>
  )
}
