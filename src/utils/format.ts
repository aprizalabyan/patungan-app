const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** `200000` → `Rp200.000`. Intl inserts a (non-breaking) space after "Rp"; we drop it. */
export function formatRupiah(amount: number): string {
  return rupiahFormatter.format(amount).replace(/\s/g, '')
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

/**
 * Formats a backend `date` (`YYYY-MM-DD`) as e.g. `12 Desember 2026`.
 * Parsed as a local calendar date so it never shifts across timezones.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return '-'
  const [, y, m, d] = match
  return dateFormatter.format(new Date(Number(y), Number(m) - 1, Number(d)))
}

/** Formats a backend datetime in WIB, e.g. `12 Des 2026, 14.30 WIB`. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${dateTimeFormatter.format(date)} WIB`
}

/** Parses user input such as `200.000`, `Rp 200.000` or `200000` into an integer. */
export function parseRupiahInput(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

/** Adds thousand separators to an amount field as the user types: `200000` → `200.000`. */
export function formatAmountInput(value: string): string {
  const n = parseRupiahInput(value)
  return n === null ? '' : new Intl.NumberFormat('id-ID').format(n)
}
