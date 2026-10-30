import type {
  ContributionListParams,
  EventListParams,
  FriendListParams,
  PublicEventListParams,
} from '@/types/api'

/** Hierarchical keys so a prefix invalidates everything beneath it. */
export const queryKeys = {
  me: ['auth', 'me'] as const,

  friends: {
    all: ['friends'] as const,
    list: (params: FriendListParams) => ['friends', 'list', params] as const,
  },

  events: {
    all: ['events'] as const,
    lists: ['events', 'list'] as const,
    list: (params: EventListParams) => ['events', 'list', params] as const,
    everything: ['events', 'everything'] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    summaries: ['events', 'summary'] as const,
    summary: (id: string) => ['events', 'summary', id] as const,
    contributions: (id: string) => ['events', 'contributions', id] as const,
    contributionList: (id: string, params: ContributionListParams) =>
      ['events', 'contributions', id, params] as const,
  },

  public: {
    list: (params: PublicEventListParams) => ['public', 'events', params] as const,
    detail: (id: string) => ['public', 'event', id] as const,
    summary: (id: string) => ['public', 'summary', id] as const,
  },
}
