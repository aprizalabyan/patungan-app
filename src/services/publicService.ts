import type {
  EventSummary,
  Page,
  PublicEvent,
  PublicEventDetail,
  PublicEventListParams,
} from '@/types/api'
import { apiRequest } from './apiClient'

/** Unauthenticated, read-only endpoints. Never sends the treasurer token. */
export const publicService = {
  listEvents: (params: PublicEventListParams = {}, signal?: AbortSignal) =>
    apiRequest<Page<PublicEvent>>('/public/events', { query: { ...params }, auth: false, signal }),

  getEvent: (eventId: string, signal?: AbortSignal) =>
    apiRequest<PublicEventDetail>(`/public/events/${eventId}`, { auth: false, signal }),

  getSummary: (eventId: string, signal?: AbortSignal) =>
    apiRequest<EventSummary>(`/public/events/${eventId}/summary`, { auth: false, signal }),
}
