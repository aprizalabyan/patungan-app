import type { ApiErrorBody, ApiValidationDetail } from '@/types/api'

/** An error response from the backend (`{"error": {code, message, details}}`). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/** The request never reached the backend or no response was received. */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message)
    this.name = 'NetworkError'
  }
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const err = (value as { error: unknown }).error
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  )
}

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: 'Email atau kata sandi salah.',
  not_authenticated: 'Sesi Anda telah berakhir. Silakan masuk kembali.',
  not_found: 'Data tidak ditemukan atau sudah dihapus.',
  duplicate_contribution: 'Teman ini sudah terdaftar di acara ini.',
  friend_in_use:
    'Teman ini tidak dapat dihapus karena memiliki riwayat iuran di salah satu acara.',
  validation_error: 'Data yang dikirim tidak valid. Periksa kembali isian Anda.',
  payment_account_inactive:
    'Rekening ini sudah nonaktif sehingga tidak dapat dipakai untuk transaksi baru. Pilih rekening aktif lain.',
  payment_account_not_available:
    'Rekening ini tidak tersedia untuk acara ini. Atur rekening acara terlebih dahulu.',
  contribution_already_paid: 'Iuran ini sudah tercatat lunas. Muat ulang untuk melihat pembayarannya.',
  contribution_not_paid: 'Iuran ini belum memiliki pembayaran yang bisa dibatalkan.',
  paid_contribution_amount_locked:
    'Nominal iuran tidak dapat diubah selama sudah dibayar. Batalkan pembayaran terlebih dahulu.',
  payment_status_not_editable:
    'Status dicatat otomatis oleh pembayaran. Catat atau batalkan pembayaran untuk mengubahnya.',
  duplicate_payment_account: 'Ada rekening yang terpilih lebih dari satu kali. Periksa kembali pilihan Anda.',
  event_payment_mode_locked: 'Mode pembayaran tidak dapat diubah karena acara sudah memiliki peserta.',
  paid_only_payment_cannot_be_cancelled: 'Pembayaran pada acara catat lunas saja tidak dapat dibatalkan.',
}

/** User-facing Indonesian message for any error thrown by the API layer. */
export function getErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (error instanceof NetworkError) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda atau coba lagi nanti.'
  }
  if (error instanceof ApiError) {
    const known = MESSAGES_BY_CODE[error.code]
    if (known) return known
    if (error.status >= 500) return 'Server sedang bermasalah. Silakan coba lagi nanti.'
  }
  return fallback
}

function isValidationDetailList(value: unknown): value is ApiValidationDetail[] {
  return (
    Array.isArray(value) &&
    value.every(
      (d) =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as ApiValidationDetail).field === 'string' &&
        typeof (d as ApiValidationDetail).message === 'string',
    )
  )
}

/**
 * Maps a backend 422 to `{fieldName: message}`. The backend `field` is a dotted
 * location such as `name` or `query.page_size`; we key by its last segment.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'validation_error') return {}
  if (!isValidationDetailList(error.details)) return {}
  const result: Record<string, string> = {}
  for (const d of error.details) {
    const key = d.field.split('.').pop() || d.field
    if (key && !result[key]) result[key] = 'Nilai tidak valid.'
  }
  return result
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
