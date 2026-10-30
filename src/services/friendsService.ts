import type { Friend, FriendCreate, FriendListParams, FriendUpdate, Page } from '@/types/api'
import { apiRequest } from './apiClient'

export const friendsService = {
  list: (params: FriendListParams = {}, signal?: AbortSignal) =>
    apiRequest<Page<Friend>>('/friends', { query: { ...params }, signal }),

  get: (friendId: string, signal?: AbortSignal) =>
    apiRequest<Friend>(`/friends/${friendId}`, { signal }),

  create: (body: FriendCreate) => apiRequest<Friend>('/friends', { method: 'POST', body }),

  update: (friendId: string, body: FriendUpdate) =>
    apiRequest<Friend>(`/friends/${friendId}`, { method: 'PATCH', body }),

  remove: (friendId: string) => apiRequest<void>(`/friends/${friendId}`, { method: 'DELETE' }),
}
