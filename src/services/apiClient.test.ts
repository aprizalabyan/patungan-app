import { describe, expect, it, vi } from 'vitest'
import { apiError, mockApi } from '@/test/utils'
import { apiRequest, buildUrl, setUnauthorizedHandler } from './apiClient'
import { ApiError, NetworkError, getErrorMessage, getFieldErrors } from './errors'
import { session } from './session'

describe('apiClient', () => {
  it('builds URLs and drops empty query values', () => {
    expect(buildUrl('/friends', { search: '', page: 2, status: undefined })).toBe(
      'http://localhost:8001/api/v1/friends?page=2',
    )
  })

  it('sends the bearer token on authenticated requests only', async () => {
    const { calls } = mockApi({ 'GET /events': { body: [] }, 'GET /public/events': { body: [] } })
    session.set('abc')
    await apiRequest('/events')
    await apiRequest('/public/events', { auth: false })
    expect(calls[0].headers.Authorization).toBe('Bearer abc')
    expect(calls[1].headers.Authorization).toBeUndefined()
  })

  it('refreshes once for concurrent 401s and retries each request with the new token', async () => {
    const { calls } = mockApi({
      'GET /events': (call) => call.headers.Authorization === 'Bearer old-token'
        ? apiError(401, 'not_authenticated')
        : { body: { ok: true } },
      'GET /friends': (call) => call.headers.Authorization === 'Bearer old-token'
        ? apiError(401, 'not_authenticated')
        : { body: { ok: true } },
      'POST /auth/refresh': { body: { access_token: 'new-token' } },
    })
    session.set('old-token')

    await expect(Promise.all([apiRequest('/events'), apiRequest('/friends')])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ])
    expect(calls.filter((call) => call.path === '/auth/refresh')).toHaveLength(1)
    expect(calls.filter((call) => call.path === '/events' || call.path === '/friends')).toHaveLength(4)
    expect(session.getToken()).toBe('new-token')
    expect(calls.find((call) => call.path === '/auth/refresh')?.credentials).toBe('include')
  })

  it('maps the backend error envelope to ApiError', async () => {
    mockApi({ 'DELETE /friends/f-1': apiError(409, 'friend_in_use', 'in use', { contributions: 2 }) })
    session.set('abc')
    const err = await apiRequest('/friends/f-1', { method: 'DELETE' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('friend_in_use')
    expect((err as ApiError).details).toEqual({ contributions: 2 })
  })

  it('clears the session and notifies on 401 for authenticated requests', async () => {
    mockApi({ 'GET /auth/me': apiError(401, 'not_authenticated') })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    session.set('abc')
    await expect(apiRequest('/auth/me')).rejects.toBeInstanceOf(ApiError)
    expect(session.getToken()).toBeNull()
    expect(handler).toHaveBeenCalledOnce()
    setUnauthorizedHandler(null)
  })

  it('does not treat a failed login (unauthenticated request) as an expired session', async () => {
    mockApi({ 'POST /auth/login': apiError(401, 'invalid_credentials') })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    await expect(apiRequest('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toThrow()
    expect(handler).not.toHaveBeenCalled()
    setUnauthorizedHandler(null)
  })

  it('wraps fetch failures in NetworkError with an Indonesian message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const err = await apiRequest('/events').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(NetworkError)
    expect(getErrorMessage(err)).toMatch(/Tidak dapat terhubung/)
  })

  it('extracts field errors from validation responses', () => {
    const err = new ApiError(422, 'validation_error', 'x', [{ field: 'phone', message: 'bad' }])
    expect(getFieldErrors(err)).toEqual({ phone: 'Nilai tidak valid.' })
  })

  it('keeps access tokens in memory only', () => {
    session.set('abc')
    expect(session.getToken()).toBe('abc')
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.getItem('patungan.session')).toBeNull()
  })
})
