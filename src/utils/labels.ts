import type { EventStatus, PaymentAccountType, PaymentStatus } from '@/types/api'

export const eventStatusLabel: Record<EventStatus, string> = {
  active: 'Aktif',
  completed: 'Selesai',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'Belum bayar',
  paid: 'Lunas',
}

export const paymentAccountTypeLabel: Record<PaymentAccountType, string> = {
  bank: 'Bank',
  e_wallet: 'E-wallet',
  cash: 'Tunai',
}

/** Shown for legacy payments recorded without an account. */
export const UNKNOWN_ACCOUNT_LABEL = 'Rekening tidak tercatat'

export function visibilityLabel(isPublic: boolean): string {
  return isPublic ? 'Publik' : 'Privat'
}
