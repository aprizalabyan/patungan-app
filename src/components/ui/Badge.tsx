import type { ReactNode } from 'react'
import type { EventStatus, PaymentAccountType, PaymentStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { eventStatusLabel, paymentAccountTypeLabel, paymentStatusLabel, visibilityLabel } from '@/utils/labels'

export type BadgeTone = 'green' | 'amber' | 'stone' | 'blue'

const tones: Record<BadgeTone, string> = {
  green: 'bg-green-50 text-green-800 ring-green-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  stone: 'bg-stone-100 text-stone-700 ring-stone-500/20',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/20',
}

export function Badge({ tone = 'stone', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone: BadgeTone = status === 'paid' ? 'green' : 'amber'
  return <Badge tone={tone}>{paymentStatusLabel[status]}</Badge>
}

const accountTypeTones: Record<PaymentAccountType, BadgeTone> = { bank: 'blue', e_wallet: 'green', cash: 'amber' }

/** Bank, e-wallet and cash each get their own colour so they are told apart at a glance. */
export function PaymentAccountTypeBadge({ type }: { type: PaymentAccountType }) {
  return <Badge tone={accountTypeTones[type]}>{paymentAccountTypeLabel[type]}</Badge>
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge tone={status === 'active' ? 'green' : 'stone'}>{eventStatusLabel[status]}</Badge>
}

export function VisibilityBadge({ isPublic }: { isPublic: boolean }) {
  return <Badge tone={isPublic ? 'blue' : 'stone'}>{visibilityLabel(isPublic)}</Badge>
}
