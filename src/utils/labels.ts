import type { EventStatus, PaymentStatus } from '@/types/api'

export const eventStatusLabel: Record<EventStatus, string> = {
  active: 'Aktif',
  completed: 'Selesai',
}

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: 'Belum bayar',
  paid: 'Lunas',
}

export function visibilityLabel(isPublic: boolean): string {
  return isPublic ? 'Publik' : 'Privat'
}
