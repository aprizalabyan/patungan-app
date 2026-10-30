import { describe, expect, it, vi } from 'vitest'
import { apiError, mockApi } from '@/test/utils'
import { apiRequest, buildUrl, setUnauthorizedHandler } from './apiClient'
import { ApiError, NetworkError, getErrorMessage, getFieldErrors } from './errors'
import { session } from './session'

describe('apiClient', () => {
  it('builds URLs and drops empty query values', () => {
    expect(buildUrl('/friends', { search: '', page: 2, status: undefined })).toBe(
      'http://localhost:8000/api/v1/friends?page=2',
    )
  })

  it('sends the bearer token on authenticated requests only', async () => {
    const { calls } = mockApi({ 'GET /events': { body: [] }, 'GET /public/events': { body: [] } })
    session.set('abc', 3600)
    await apiRequest('/events')
    await apiRequest('/public/events', { auth: false })
    expect(calls[0].headers.Authorization).toBe('Bearer abc')
    expect(calls[1].headers.Authorization).toBeUndefined()
  })

  it('maps the backend error envelope to ApiError', async () => {
    mockApi({ 'DELETE /friends/f-1': apiError(409, 'friend_in_use', 'in use', { contributions: 2 }) })
    session.set('abc', 3600)
    const err = await apiRequest('/friends/f-1', { method: 'DELETE' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('friend_in_use')
    expect((err as ApiError).details).toEqual({ contributions: 2 })
  })

  it('clears the session and notifies on 401 for authenticated requests', async () => {
    mockApi({ 'GET /auth/me': apiError(401, 'not_authenticated') })
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    session.set('abc', 3600)
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

  it('treats an expired stored token as signed out', () => {
    session.set('abc', 0)
    expect(session.getToken()).toBeNull()
  })
})
