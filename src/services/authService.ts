import type { LoginRequest, TokenResponse, User } from '@/types/api'
import { apiRequest } from './apiClient'

export const authService = {
  // auth: false so a wrong password (401 invalid_credentials) is not treated as an expired session.
  login: (body: LoginRequest) =>
    apiRequest<TokenResponse>('/auth/login', { method: 'POST', body, auth: false }),

  me: (signal?: AbortSignal) => apiRequest<User>('/auth/me', { signal }),
}
