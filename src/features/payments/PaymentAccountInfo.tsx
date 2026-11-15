import { Badge, PaymentAccountTypeBadge } from '@/components/ui/Badge'
import type { PaymentAccountSnapshot } from '@/types/api'

type AccountIdentity = Pick<
  PaymentAccountSnapshot,
  'type' | 'provider_name' | 'account_name' | 'account_number' | 'label'
>

/** Provider, type, owner, number and label of an account (or of a payment's snapshot). */
export function PaymentAccountInfo({ account, inactive = false }: { account: AccountIdentity; inactive?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2 font-medium text-stone-900">
        <span>{account.provider_name}</span>
        <PaymentAccountTypeBadge type={account.type} />
        {inactive && <Badge tone="stone">Nonaktif</Badge>}
      </p>
      <p className="text-sm break-words text-stone-700">
        {account.type === 'cash' ? (
          <>Dipegang oleh {account.account_name}</>
        ) : (
          <>
            {account.account_name} · <span className="tabular-nums">{account.account_number}</span>
          </>
        )}
      </p>
      {account.label && <p className="text-xs break-words text-stone-500">{account.label}</p>}
    </div>
  )
}
