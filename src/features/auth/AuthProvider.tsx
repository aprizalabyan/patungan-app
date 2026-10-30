import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useToast } from '@/components/ui/Toast'
import { setUnauthorizedHandler } from '@/services/apiClient'
import { authService } from '@/services/authService'
import { queryKeys } from '@/services/queryKeys'
import { session } from '@/services/session'
import type { LoginRequest } from '@/types/api'
import { AuthContext, type AuthContextValue } from './authContext'

function getToken() {
  return session.getToken()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const token = useSyncExternalStore(session.subscribe, getToken, getToken)

  // A 401 on any authenticated request: the API client has already cleared the
  // session, which re-renders guards into a redirect. Drop cached private data too.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.clear()
      toast.info('Sesi Anda telah berakhir. Silakan masuk kembali.')
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient, toast])

  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => authService.me(signal),
    enabled: token !== null,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const res = await authService.login(credentials)
      queryClient.clear()
      session.set(res.access_token, res.expires_in)
    },
    [queryClient],
  )

  const logout = useCallback(() => {
    session.clear()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthContextValue['status']
    if (token === null) status = 'unauthenticated'
    else if (meQuery.data) status = 'authenticated'
    else if (meQuery.isError) status = 'error'
    else status = 'loading'
    return {
      status,
      user: token ? (meQuery.data ?? null) : null,
      error: meQuery.error,
      retry: () => void meQuery.refetch(),
      login,
      logout,
    }
  }, [token, meQuery, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
