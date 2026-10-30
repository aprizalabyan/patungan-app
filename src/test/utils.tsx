import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { vi } from 'vitest'
import { AppProviders } from '@/AppProviders'
import { AppRoutes } from '@/AppRoutes'
import { API_BASE_URL } from '@/services/config'
import { session } from '@/services/session'
import type { Contribution, Event, EventSummary, Friend, User } from '@/types/api'

export interface RecordedCall {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
  headers: Record<string, string>
}

type Reply = { status?: number; body?: unknown } | ((call: RecordedCall) => { status?: number; body?: unknown })

/**
 * Stubs `fetch` with a routing table keyed by `"METHOD /path"` (path relative to
 * the API base URL, without query string). Unmatched requests fail the test.
 */
export function mockApi(routes: Record<string, Reply>) {
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.href.slice(API_BASE_URL.length).split('?')[0]
    const method = (init?.method ?? 'GET').toUpperCase()
    const call: RecordedCall = {
      method,
      path,
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    }
    calls.push(call)
    const route = routes[`${method} ${path}`]
    if (!route) throw new Error(`Unmocked request: ${method} ${path}`)
    const { status = 200, body } = typeof route === 'function' ? route(call) : route
    return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, routes }
}

export function apiError(status: number, code: string, message = code, details: unknown = null) {
  return { status, body: { error: { code, message, details } } }
}

export function page<T>(items: T[], total = items.length, pageNo = 1, pageSize = 20) {
  return { items, total, page: pageNo, page_size: pageSize }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

export function renderApp(route: string, { loggedIn = false }: { loggedIn?: boolean } = {}) {
  if (loggedIn) session.set('test-token', 3600)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  })
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders queryClient={queryClient}>
        <AppRoutes />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  )
  return { ...utils, queryClient }
}

// --- Fixtures ------------------------------------------------------------------

export const user: User = {
  id: 'u-1',
  name: 'Bendahara',
  email: 'bendahara@example.com',
  created_at: '2026-01-01T00:00:00Z',
}

export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e-1',
    title: 'Kado Rina & Dimas',
    description: 'Patungan kado pernikahan',
    event_date: '2026-12-12',
    target_amount: 2_000_000,
    status: 'active',
    is_public: true,
    created_by: 'u-1',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

export function makeSummary(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    event_id: 'e-1',
    total_participants: 2,
    paid_count: 1,
    pending_count: 1,
    total_collected: 200_000,
    total_pending: 150_000,
    target_amount: 2_000_000,
    progress_percent: 10,
    ...overrides,
  }
}

export function makeFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'f-1',
    name: 'Budi Santoso',
    nickname: 'Budi',
    phone: '+62 812-3456-7890',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export function makeContribution(overrides: Partial<Contribution> = {}): Contribution {
  return {
    id: 'c-1',
    event_id: 'e-1',
    friend_id: 'f-1',
    friend: { id: 'f-1', name: 'Budi Santoso', nickname: 'Budi' },
    amount: 150_000,
    payment_status: 'pending',
    paid_at: null,
    notes: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}
