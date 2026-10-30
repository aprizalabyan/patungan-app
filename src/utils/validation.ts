/** Client-side checks mirroring backend constraints. The backend stays authoritative. */

export const MAX_AMOUNT = 1_000_000_000_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9 \-()]*$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  const v = value.trim()
  return v.length >= 3 && v.length <= 30 && PHONE_RE.test(v)
}

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export function hasErrors<K extends string>(errors: FieldErrors<K>): boolean {
  return Object.values(errors).some(Boolean)
}

/** Blank strings become null so optional fields are cleared rather than stored empty. */
export function emptyToNull(value: string): string | null {
  const v = value.trim()
  return v === '' ? null : v
}
