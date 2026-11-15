import type {
  Contribution,
  ContributionPaymentCancel,
  ContributionPaymentRecord,
  EventPaymentAccountsUpdate,
  PaymentAccount,
  PaymentAccountCreate,
  PaymentAccountListParams,
  PaymentAccountUpdate,
} from '@/types/api'
import { apiRequest } from './apiClient'

/** Global (treasurer-owned) payment accounts. The list is not paginated; there is no DELETE. */
export const paymentAccountsService = {
  list: (params: PaymentAccountListParams = {}, signal?: AbortSignal) =>
    apiRequest<PaymentAccount[]>('/payment-accounts', { query: { ...params }, signal }),

  create: (body: PaymentAccountCreate) =>
    apiRequest<PaymentAccount>('/payment-accounts', { method: 'POST', body }),

  update: (id: string, body: PaymentAccountUpdate) =>
    apiRequest<PaymentAccount>(`/payment-accounts/${id}`, { method: 'PATCH', body }),

  setActive: (id: string, isActive: boolean) =>
    apiRequest<PaymentAccount>(`/payment-accounts/${id}/status`, {
      method: 'PATCH',
      body: { is_active: isActive },
    }),
}

/** Accounts offered by one event for receiving payments. */
export const eventPaymentAccountsService = {
  list: (eventId: string, signal?: AbortSignal) =>
    apiRequest<PaymentAccount[]>(`/events/${eventId}/payment-accounts`, { signal }),

  replace: (eventId: string, body: EventPaymentAccountsUpdate) =>
    apiRequest<PaymentAccount[]>(`/events/${eventId}/payment-accounts`, { method: 'PUT', body }),
}

/**
 * The single payment of a contribution. Both calls return the whole contribution, whose
 * status, `paid_at` and account snapshot are the source of truth.
 */
export const contributionPaymentService = {
  record: (contributionId: string, body: ContributionPaymentRecord) =>
    apiRequest<Contribution>(`/contributions/${contributionId}/payment`, { method: 'PATCH', body }),

  /** The reason is optional; with none the request has no body. */
  cancel: (contributionId: string, body?: ContributionPaymentCancel) =>
    apiRequest<Contribution>(`/contributions/${contributionId}/payment/cancel`, { method: 'POST', body }),
}
