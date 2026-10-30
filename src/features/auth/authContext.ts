import { createContext, useContext } from 'react'
import type { LoginRequest, User } from '@/types/api'

export interface AuthContextValue {
  /**
   * `loading`: token present, profile being verified. `error`: token present but
   * `/auth/me` failed for a non-401 reason (e.g. network). A 401 clears the token.
   */
  status: 'loading' | 'authenticated' | 'unauthenticated' | 'error'
  user: User | null
  error: unknown
  retry: () => void
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
