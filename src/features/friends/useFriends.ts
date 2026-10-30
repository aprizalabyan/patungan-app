import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { friendsService } from '@/services/friendsService'
import { queryKeys } from '@/services/queryKeys'
import type { FriendCreate, FriendListParams, FriendUpdate } from '@/types/api'

export function useFriendsList(params: FriendListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.friends.list(params),
    queryFn: ({ signal }) => friendsService.list(params, signal),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCreateFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: FriendCreate) => friendsService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.friends.all }),
  })
}

export function useUpdateFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FriendUpdate }) => friendsService.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.friends.all })
      // Contributions embed the friend's name/nickname.
      void qc.invalidateQueries({ queryKey: ['events', 'contributions'] })
    },
  })
}

export function useDeleteFriend() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => friendsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.friends.all }),
  })
}
