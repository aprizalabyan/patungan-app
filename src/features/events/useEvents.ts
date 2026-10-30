import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { MAX_PAGE_SIZE } from '@/services/constants'
import { contributionsService, eventsService } from '@/services/eventsService'
import { queryKeys } from '@/services/queryKeys'
import type {
  Contribution,
  ContributionCreate,
  ContributionListParams,
  ContributionUpdate,
  Event,
  EventCreate,
  EventListParams,
  EventSummary,
  EventUpdate,
  Page,
} from '@/types/api'

// --- Events ------------------------------------------------------------------

export function useEventsList(params: EventListParams) {
  return useQuery({
    queryKey: queryKeys.events.list(params),
    queryFn: ({ signal }) => eventsService.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * Every event of the treasurer, walking all pages. Used by the dashboard, which
 * needs a complete set (the backend has no aggregate dashboard endpoint).
 */
export function useAllEvents() {
  return useQuery({
    queryKey: queryKeys.events.everything,
    queryFn: async ({ signal }) => {
      const items: Event[] = []
      for (let page = 1; ; page++) {
        const res = await eventsService.list({ page, page_size: MAX_PAGE_SIZE }, signal)
        items.push(...res.items)
        if (items.length >= res.total || res.items.length === 0) return { items, total: res.total }
      }
    },
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(eventId),
    queryFn: ({ signal }) => eventsService.get(eventId, signal),
  })
}

export function useEventSummary(eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.summary(eventId),
    queryFn: ({ signal }) => eventsService.summary(eventId, signal),
  })
}

/** Backend summaries for several events (shared cache with `useEventSummary`). */
export function useEventSummaries(eventIds: string[]) {
  return useQueries({
    queries: eventIds.map((id) => ({
      queryKey: queryKeys.events.summary(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => eventsService.summary(id, signal),
    })),
    combine: (results) => {
      const byId = new Map<string, EventSummary>()
      results.forEach((r, i) => {
        if (r.data) byId.set(eventIds[i], r.data)
      })
      return {
        byId,
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
        error: results.find((r) => r.error)?.error ?? null,
        refetch: () => results.forEach((r) => void r.refetch()),
      }
    },
  })
}

function invalidateEventLists(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: queryKeys.events.lists })
  void qc.invalidateQueries({ queryKey: queryKeys.events.everything })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EventCreate) => eventsService.create(body),
    onSuccess: (event) => {
      qc.setQueryData(queryKeys.events.detail(event.id), event)
      invalidateEventLists(qc)
    },
  })
}

export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: EventUpdate) => eventsService.update(eventId, body),
    onSuccess: (event) => {
      qc.setQueryData(queryKeys.events.detail(eventId), event)
      invalidateEventLists(qc)
      // target_amount drives progress_percent.
      void qc.invalidateQueries({ queryKey: queryKeys.events.summary(eventId) })
    },
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) => eventsService.remove(eventId),
    onSuccess: (_, eventId) => {
      qc.removeQueries({ queryKey: queryKeys.events.detail(eventId) })
      qc.removeQueries({ queryKey: queryKeys.events.summary(eventId) })
      qc.removeQueries({ queryKey: queryKeys.events.contributions(eventId) })
      invalidateEventLists(qc)
    },
  })
}

// --- Contributions -----------------------------------------------------------

/**
 * All participants of an event, walking every page. A friend can join an event
 * at most once, so this is bounded by the size of the friend list.
 */
export function useAllContributions(eventId: string, params: ContributionListParams = {}) {
  return useQuery({
    queryKey: queryKeys.events.contributionList(eventId, params),
    queryFn: async ({ signal }): Promise<Page<Contribution>> => {
      const items: Contribution[] = []
      for (let page = 1; ; page++) {
        const res = await contributionsService.list(
          eventId,
          { ...params, page, page_size: MAX_PAGE_SIZE },
          signal,
        )
        items.push(...res.items)
        if (items.length >= res.total || res.items.length === 0) {
          return { items, total: res.total, page: 1, page_size: items.length }
        }
      }
    },
  })
}

/**
 * After any contribution change, refetch everything derived from it on the
 * server: the participant list and the event summary (totals, counts, progress).
 */
export function invalidateContributionData(qc: QueryClient, eventId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.events.contributions(eventId) }),
    qc.invalidateQueries({ queryKey: queryKeys.events.summary(eventId) }),
  ])
}

export function useAddContribution(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ContributionCreate) => contributionsService.create(eventId, body),
    onSuccess: () => invalidateContributionData(qc, eventId),
  })
}

export function useUpdateContribution(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ContributionUpdate }) =>
      contributionsService.update(id, body),
    onSuccess: (updated) => {
      // Show the server's row (incl. paid_at) immediately, then reconcile.
      qc.setQueriesData<Page<Contribution>>(
        { queryKey: queryKeys.events.contributions(eventId) },
        (page) =>
          page && {
            ...page,
            items: page.items.map((c) => (c.id === updated.id ? updated : c)),
          },
      )
      return invalidateContributionData(qc, eventId)
    },
  })
}

export function useDeleteContribution(eventId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (contributionId: string) => contributionsService.remove(contributionId),
    onSuccess: () => invalidateContributionData(qc, eventId),
  })
}
