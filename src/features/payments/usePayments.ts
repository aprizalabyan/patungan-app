import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { applyContributionRow, invalidateContributionData } from '@/features/events/useEvents'
import { ApiError } from '@/services/errors'
import {
  contributionPaymentService,
  eventPaymentAccountsService,
  paymentAccountsService,
} from '@/services/paymentsService'
import { queryKeys } from '@/services/queryKeys'
import type {
  ContributionPaymentCancel,
  ContributionPaymentRecord,
  PaymentAccount,
  PaymentAccountCreate,
  PaymentAccountListParams,
  PaymentAccountUpdate,
} from '@/types/api'

// --- Payment accounts (global) --------------------------------------------------

export function usePaymentAccounts(params: PaymentAccountListParams = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.paymentAccounts.list(params),
    queryFn: ({ signal }) => paymentAccountsService.list(params, signal),
    enabled,
  })
}

/**
 * An account's identity feeds: the account list, every event's account list
 * (is_active / names) and event summaries (the breakdown shows the *current* identity).
 */
function invalidateAccountData(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.paymentAccounts.all }),
    qc.invalidateQueries({ queryKey: queryKeys.events.paymentAccountsAll }),
    qc.invalidateQueries({ queryKey: queryKeys.events.summaries }),
  ])
}

export function useCreatePaymentAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PaymentAccountCreate) => paymentAccountsService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.paymentAccounts.all }),
  })
}

export function useUpdatePaymentAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PaymentAccountUpdate }) =>
      paymentAccountsService.update(id, body),
    onSuccess: () => invalidateAccountData(qc),
  })
}

export function useSetPaymentAccountActive() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      paymentAccountsService.setActive(id, isActive),
    onSuccess: () => invalidateAccountData(qc),
  })
}

// --- Event payment accounts -----------------------------------------------------

export function useEventPaymentAccounts(eventId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.events.paymentAccounts(eventId),
    queryFn: ({ signal }) => eventPaymentAccountsService.list(eventId, signal),
    enabled,
  })
}

export function useReplaceEventPaymentAccounts(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentAccountIds: string[]) =>
      eventPaymentAccountsService.replace(eventId, { payment_account_ids: paymentAccountIds }),
    onSuccess: (accounts) => {
      qc.setQueryData<PaymentAccount[]>(queryKeys.events.paymentAccounts(eventId), accounts)
      // The summary breakdown lists every account linked to the event.
      void qc.invalidateQueries({ queryKey: queryKeys.events.summary(eventId) })
    },
    onError: (error) => {
      // 409 inactive / 404: our copy of the account list is stale.
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        void qc.invalidateQueries({ queryKey: queryKeys.paymentAccounts.all })
      }
    },
  })
}

// --- Contribution payment (single) ----------------------------------------------

/**
 * A 409 that says our view is stale (already paid / not paid / account no longer usable):
 * refetch the rows and the event's accounts instead of leaving outdated data on screen.
 */
function refreshAfterRejection(qc: QueryClient, eventId: string, error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) return
  void invalidateContributionData(qc, eventId)
  if (error.code === 'payment_account_inactive' || error.code === 'payment_account_not_available') {
    void qc.invalidateQueries({ queryKey: queryKeys.events.paymentAccounts(eventId) })
    void qc.invalidateQueries({ queryKey: queryKeys.paymentAccounts.all })
  }
}

/** Records the contribution's one payment. Refreshes the participant rows and the event summary. */
export function useRecordContributionPayment(eventId: string, contributionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ContributionPaymentRecord) => contributionPaymentService.record(contributionId, body),
    onSuccess: (updated) => {
      applyContributionRow(qc, eventId, updated)
      return invalidateContributionData(qc, eventId)
    },
    onError: (error) => refreshAfterRejection(qc, eventId, error),
  })
}

/** Cancels the payment; the contribution goes back to pending. Refreshes the same data. */
export function useCancelContributionPayment(eventId: string, contributionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body?: ContributionPaymentCancel) => contributionPaymentService.cancel(contributionId, body),
    onSuccess: (updated) => {
      applyContributionRow(qc, eventId, updated)
      return invalidateContributionData(qc, eventId)
    },
    onError: (error) => refreshAfterRejection(qc, eventId, error),
  })
}
