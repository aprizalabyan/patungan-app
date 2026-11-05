import { API_BASE_URL } from './config'
import { ApiError, NetworkError, isApiErrorBody } from './errors'
import { session } from './session'

type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue>
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: QueryParams
  auth?: boolean
  credentials?: RequestCredentials
  signal?: AbortSignal
}

let unauthorizedHandler: (() => void) | null = null
let refreshFlight: Promise<string> | null = null
export function setUnauthorizedHandler(handler: (() => void) | null): void { unauthorizedHandler = handler }

export function buildUrl(path: string, query?: QueryParams): string {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try { return JSON.parse(text) as unknown } catch { return text }
}

async function rawRequest<T>(path: string, options: RequestOptions = {}, token = session.getToken()): Promise<T> {
  const { method = 'GET', body, query, auth = true, signal, credentials = 'omit' } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal, credentials })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new NetworkError()
  }
  const data = await parseBody(response)
  if (!response.ok) {
    if (isApiErrorBody(data)) throw new ApiError(response.status, data.error.code, data.error.message, data.error.details)
    throw new ApiError(response.status, 'http_error', response.statusText || 'Request failed')
  }
  return data as T
}

interface TokenResponse { access_token: string }
const refreshPaths = ['/auth/login', '/auth/refresh', '/auth/logout']
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('patungan-auth')
let refreshRevision = 0
type AuthEvent = 'AUTH_LOGIN' | 'AUTH_LOGOUT' | 'AUTH_SESSION_EXPIRED' | 'AUTH_TOKEN_REFRESHED'
const authListeners = new Set<(event: AuthEvent) => void>()
channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data
  if (message === 'AUTH_LOGIN' || message === 'AUTH_LOGOUT' || message === 'AUTH_SESSION_EXPIRED' || message === 'AUTH_TOKEN_REFRESHED') {
    authListeners.forEach((listener) => listener(message))
  }
  if (event.data === 'AUTH_TOKEN_REFRESHED') refreshRevision += 1
  if (event.data === 'AUTH_LOGOUT' || event.data === 'AUTH_SESSION_EXPIRED') {
    session.clear()
    unauthorizedHandler?.()
  }
})

async function coordinateRefresh(): Promise<string> {
  const doRefresh = async () => {
    const before = refreshRevision
    const result = await rawRequest<TokenResponse>('/auth/refresh', { method: 'POST', auth: false, credentials: 'include' }, null)
    session.set(result.access_token)
    if (refreshRevision === before) channel?.postMessage('AUTH_TOKEN_REFRESHED')
    return result.access_token
  }
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('patungan-auth-refresh', doRefresh)
  }
  // Legacy fallback: a short, non-secret localStorage lease. This is best-effort;
  // browsers without Web Locks cannot guarantee mutual exclusion after crashes.
  const leaseKey = 'patungan.auth.refresh-lock'
  const owner = `${Date.now()}-${Math.random()}`
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const current = Number(localStorage.getItem(leaseKey)?.split(':')[0] || 0)
      if (current < Date.now()) {
        localStorage.setItem(leaseKey, `${Date.now() + 15_000}:${owner}`)
        if (localStorage.getItem(leaseKey)?.endsWith(owner)) {
          try { return await doRefresh() } finally { if (localStorage.getItem(leaseKey)?.endsWith(owner)) localStorage.removeItem(leaseKey) }
        }
      }
    } catch { return doRefresh() }
    await new Promise((resolve) => setTimeout(resolve, 80))
  }
  throw new ApiError(401, 'not_authenticated', 'Refresh coordination timed out')
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshFlight) {
    refreshFlight = coordinateRefresh().catch((error: unknown) => {
      session.clear()
      channel?.postMessage('AUTH_SESSION_EXPIRED')
      throw error
    }).finally(() => { refreshFlight = null })
  }
  return refreshFlight
}

export function announceAuthEvent(event: 'AUTH_LOGIN' | 'AUTH_LOGOUT'): void { channel?.postMessage(event) }
export function subscribeAuthEvents(listener: (event: AuthEvent) => void): () => void {
  authListeners.add(listener)
  return () => authListeners.delete(listener)
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestToken = options.auth === false ? null : session.getToken()
  try {
    return await rawRequest<T>(path, options)
  } catch (error) {
    const { auth = true } = options
    if (!(error instanceof ApiError) || error.status !== 401 || !auth || refreshPaths.includes(path) || path.startsWith('/public/')) throw error
    try {
      const latestToken = session.getToken()
      const token = latestToken && latestToken !== requestToken ? latestToken : await refreshAccessToken()
      return await rawRequest<T>(path, options, token)
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        session.clear()
        channel?.postMessage('AUTH_SESSION_EXPIRED')
      }
      unauthorizedHandler?.()
      throw retryError
    }
  }
}
