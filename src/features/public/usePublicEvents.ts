import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { isNotFound } from '@/services/errors'
import { publicService } from '@/services/publicService'
import { queryKeys } from '@/services/queryKeys'
import type { PublicEventListParams } from '@/types/api'

/** Don't retry a 404: it means the event is private or does not exist. */
function retryUnlessNotFound(failureCount: number, error: unknown) {
  return !isNotFound(error) && failureCount < 2
}

export function usePublicEventsList(params: PublicEventListParams) {
  return useQuery({
    queryKey: queryKeys.public.list(params),
    queryFn: ({ signal }) => publicService.listEvents(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function usePublicEvent(eventId: string) {
  return useQuery({
    queryKey: queryKeys.public.detail(eventId),
    queryFn: ({ signal }) => publicService.getEvent(eventId, signal),
    retry: retryUnlessNotFound,
  })
}

export function usePublicEventSummary(eventId: string) {
  return useQuery({
    queryKey: queryKeys.public.summary(eventId),
    queryFn: ({ signal }) => publicService.getSummary(eventId, signal),
    retry: retryUnlessNotFound,
  })
}
