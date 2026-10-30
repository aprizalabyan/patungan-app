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
import { apiRequest } from './apiClient'

export const eventsService = {
  list: (params: EventListParams = {}, signal?: AbortSignal) =>
    apiRequest<Page<Event>>('/events', { query: { ...params }, signal }),

  get: (eventId: string, signal?: AbortSignal) =>
    apiRequest<Event>(`/events/${eventId}`, { signal }),

  create: (body: EventCreate) => apiRequest<Event>('/events', { method: 'POST', body }),

  update: (eventId: string, body: EventUpdate) =>
    apiRequest<Event>(`/events/${eventId}`, { method: 'PATCH', body }),

  remove: (eventId: string) => apiRequest<void>(`/events/${eventId}`, { method: 'DELETE' }),

  summary: (eventId: string, signal?: AbortSignal) =>
    apiRequest<EventSummary>(`/events/${eventId}/summary`, { signal }),
}

export const contributionsService = {
  list: (eventId: string, params: ContributionListParams = {}, signal?: AbortSignal) =>
    apiRequest<Page<Contribution>>(`/events/${eventId}/contributions`, {
      query: { ...params },
      signal,
    }),

  create: (eventId: string, body: ContributionCreate) =>
    apiRequest<Contribution>(`/events/${eventId}/contributions`, { method: 'POST', body }),

  update: (contributionId: string, body: ContributionUpdate) =>
    apiRequest<Contribution>(`/contributions/${contributionId}`, { method: 'PATCH', body }),

  remove: (contributionId: string) =>
    apiRequest<void>(`/contributions/${contributionId}`, { method: 'DELETE' }),
}
