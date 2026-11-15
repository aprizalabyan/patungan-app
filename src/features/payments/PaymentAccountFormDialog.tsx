import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { SelectField, TextField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { getErrorMessage, getFieldErrors } from '@/services/errors'
import type { PaymentAccount, PaymentAccountCreate, PaymentAccountType, PaymentAccountUpdate } from '@/types/api'
import { paymentAccountTypeLabel } from '@/utils/labels'
import { emptyToNull, hasErrors, type FieldErrors } from '@/utils/validation'

type Field = 'type' | 'provider_name' | 'account_name' | 'account_number' | 'label'

const LIMITS = { provider_name: 100, account_name: 150, account_number: 100, label: 100 } as const

interface PaymentAccountFormDialogProps {
  open: boolean
  /** When set the dialog edits this account; otherwise it creates one. */
  account?: PaymentAccount
  /** Providers already used by the treasurer; suggestions only, never a fixed list. */
  providerSuggestions: string[]
  onClose: () => void
  onCreate: (body: PaymentAccountCreate) => Promise<unknown>
  onUpdate: (id: string, body: PaymentAccountUpdate) => Promise<unknown>
}

export function PaymentAccountFormDialog({ open, account, ...rest }: PaymentAccountFormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={rest.onClose}
      title={account ? 'Ubah rekening' : 'Tambah rekening'}
      description="Rekening berlaku untuk semua acara dan dapat dipilih per acara."
    >
      {open && <AccountForm key={account?.id ?? 'new'} account={account} {...rest} />}
    </Dialog>
  )
}

function requiredText(value: string, max: number, name: string): string | undefined {
  const v = value.trim()
  if (!v) return `${name} wajib diisi.`
  if (v.length > max) return `${name} maksimal ${max} karakter.`
  return undefined
}

function AccountForm({
  account,
  providerSuggestions,
  onClose,
  onCreate,
  onUpdate,
}: Omit<PaymentAccountFormDialogProps, 'open'>) {
  const [type, setType] = useState<PaymentAccountType>(account?.type ?? 'bank')
  const [provider, setProvider] = useState(account?.type === 'cash' ? '' : (account?.provider_name ?? ''))
  const [owner, setOwner] = useState(account?.account_name ?? '')
  const [number, setNumber] = useState(account?.account_number ?? '')
  const isCash = type === 'cash'
  const [label, setLabel] = useState(account?.label ?? '')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v: FieldErrors<Field> = {
      provider_name: isCash ? undefined : requiredText(provider, LIMITS.provider_name, 'Nama penyedia'),
      account_name: requiredText(owner, LIMITS.account_name, isCash ? 'Nama pemegang kas' : 'Nama pemilik'),
      account_number: isCash ? undefined : requiredText(number, LIMITS.account_number, 'Nomor rekening'),
      label: label.trim().length > LIMITS.label ? `Label maksimal ${LIMITS.label} karakter.` : undefined,
    }
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return

    // The account number stays a string end to end so leading zeros are preserved.
    // Cash has neither provider nor number: the backend fixes the provider to "Cash" and rejects a
    // number, so neither is sent.
    const values: PaymentAccountCreate = isCash
      ? { type, account_name: owner.trim(), label: emptyToNull(label) }
      : {
          type,
          provider_name: provider.trim(),
          account_name: owner.trim(),
          account_number: number.trim(),
          label: emptyToNull(label),
        }
    setSubmitting(true)
    try {
      if (account) {
        const changes: PaymentAccountUpdate = {}
        if (values.type !== account.type) changes.type = values.type
        if (!isCash) {
          // Switching from cash always sends provider and number: both are required for the new type.
          if (values.provider_name !== account.provider_name || account.type === 'cash') {
            changes.provider_name = values.provider_name
          }
          if (values.account_number !== account.account_number || account.type === 'cash') {
            changes.account_number = values.account_number
          }
        }
        if (values.account_name !== account.account_name) changes.account_name = values.account_name
        if (values.label !== account.label) changes.label = values.label
        if (Object.keys(changes).length === 0) {
          onClose()
          return
        }
        await onUpdate(account.id, changes)
      } else {
        await onCreate(values)
      }
    } catch (err) {
      const serverFields = getFieldErrors(err)
      if (Object.keys(serverFields).length > 0) {
        setErrors({
          type: serverFields.type,
          provider_name: serverFields.provider_name,
          account_name: serverFields.account_name,
          account_number: serverFields.account_number,
          label: serverFields.label,
        })
      }
      setSubmitError(getErrorMessage(err, 'Gagal menyimpan rekening.'))
    } finally {
      setSubmitting(false)
    }
  }

  const listId = 'payment-provider-suggestions'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <SelectField
        label="Jenis rekening"
        required
        value={type}
        onChange={(e) => setType(e.target.value as PaymentAccountType)}
        error={errors.type}
      >
        {(Object.keys(paymentAccountTypeLabel) as PaymentAccountType[]).map((t) => (
          <option key={t} value={t}>
            {paymentAccountTypeLabel[t]}
          </option>
        ))}
      </SelectField>
      {!isCash && (
      <TextField
        label="Nama penyedia"
        required
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        error={errors.provider_name}
        maxLength={LIMITS.provider_name}
        list={listId}
        autoComplete="off"
        placeholder="contoh: BRI, BSI, DANA, ShopeePay"
        data-autofocus
      />
      )}
      <datalist id={listId}>
        {providerSuggestions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <TextField
        label={isCash ? 'Nama pemegang kas' : 'Nama pemilik'}
        required
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        error={errors.account_name}
        maxLength={LIMITS.account_name}
        autoComplete="off"
        hint={isCash ? 'Orang yang memegang uang tunai, misalnya “Bendahara”.' : undefined}
      />
      {!isCash && (
      <TextField
        label="Nomor rekening / nomor e-wallet"
        required
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        error={errors.account_number}
        maxLength={LIMITS.account_number}
        inputMode="numeric"
        autoComplete="off"
        hint="Disimpan apa adanya, termasuk angka nol di depan."
      />
      )}
      {isCash && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Pembayaran tunai tidak memiliki penyedia maupun nomor rekening.
        </p>
      )}
      <TextField
        label="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        error={errors.label}
        maxLength={LIMITS.label}
        autoComplete="off"
        hint="Opsional, misalnya “Rekening utama”."
      />
      <InlineError message={submitError} />
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Batal
        </Button>
        <Button type="submit" loading={submitting}>
          {account ? 'Simpan perubahan' : 'Tambah rekening'}
        </Button>
      </div>
    </form>
  )
}
