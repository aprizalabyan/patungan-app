import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router'
import { useToast } from '@/components/ui/Toast'
import { announceAuthEvent, refreshAccessToken as refreshToken, setUnauthorizedHandler, subscribeAuthEvents } from '@/services/apiClient'
import { authService } from '@/services/authService'
import { ApiError } from '@/services/errors'
import { session } from '@/services/session'
import type { LoginRequest, User } from '@/types/api'
import { AuthContext, type AuthContextValue } from './authContext'

function getToken() { return session.getToken() }

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const location = useLocation()
  const toast = useToast()
  const token = useSyncExternalStore(session.subscribe, getToken, getToken)
  const [user, setUser] = useState<User | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const initialization = useRef<Promise<void> | null>(null)
  const authStarted = useRef(false)

  const clearAuth = useCallback(() => {
    session.clear()
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  const refreshAccessToken = useCallback(async () => {
    await refreshToken()
    setUser(await authService.me())
  }, [])

  const initializeAuth = useCallback(async () => {
    if (initialization.current) return initialization.current
    setIsInitializing(true)
    setError(null)
    initialization.current = (async () => {
      try {
        await refreshAccessToken()
      } catch (cause) {
        clearAuth()
        if (!(cause instanceof ApiError && cause.status === 401)) setError(cause)
      } finally {
        setIsInitializing(false)
        initialization.current = null
      }
    })()
    return initialization.current
  }, [clearAuth, refreshAccessToken])

  useEffect(() => {
    if (location.pathname.startsWith('/public')) {
      setIsInitializing(false)
      return
    }
    if (authStarted.current) return
    authStarted.current = true
    void initializeAuth()
  }, [initializeAuth, location.pathname])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth()
      toast.info('Sesi Anda telah berakhir. Silakan masuk kembali.')
    })
    const unsubscribe = subscribeAuthEvents((event) => {
      if (event === 'AUTH_LOGOUT' || event === 'AUTH_SESSION_EXPIRED') clearAuth()
      if ((event === 'AUTH_LOGIN' || event === 'AUTH_TOKEN_REFRESHED') && !token && !location.pathname.startsWith('/public')) void initializeAuth()
    })
    return () => { unsubscribe(); setUnauthorizedHandler(null) }
  }, [clearAuth, initializeAuth, location.pathname, toast, token])

  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await authService.login(credentials)
    queryClient.clear()
    session.set(response.access_token)
    setUser(await authService.me())
    announceAuthEvent('AUTH_LOGIN')
  }, [queryClient])

  const logout = useCallback(async () => {
    try { await authService.logout() } catch {
      toast.info('Sesi lokal telah ditutup, tetapi server tidak dapat dihubungi.')
    } finally {
      clearAuth()
      announceAuthEvent('AUTH_LOGOUT')
    }
  }, [clearAuth, toast])

  const retry = useCallback(() => { void initializeAuth() }, [initializeAuth])
  const value = useMemo<AuthContextValue>(() => ({
    status: isInitializing ? 'loading' : token && user ? 'authenticated' : error ? 'error' : 'unauthenticated',
    isInitializing,
    isAuthenticated: !isInitializing && Boolean(token && user),
    user: token ? user : null,
    error,
    retry,
    login,
    logout,
    refreshAccessToken,
    initializeAuth,
  }), [isInitializing, token, user, error, retry, login, logout, refreshAccessToken, initializeAuth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
