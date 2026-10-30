import type { ReactNode } from 'react'
import { formatAmountInput } from '@/utils/format'
import { TextField } from './FormField'

interface AmountFieldProps {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  required?: boolean
  name?: string
  disabled?: boolean
}

/** Rupiah input that keeps thousand separators while typing (`200.000`). */
export function AmountField({ value, onChange, ...rest }: AmountFieldProps) {
  return (
    <TextField
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      placeholder="contoh: 200.000"
      value={value}
      onChange={(e) => onChange(formatAmountInput(e.target.value))}
    />
  )
}
