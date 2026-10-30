import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { session } from '@/services/session'
import { apiError, makeEvent, makeSummary, mockApi, page, renderApp, user } from '@/test/utils'

const dashboardRoutes = {
  'GET /auth/me': { body: user },
  'GET /events': { body: page([makeEvent()]) },
  'GET /events/e-1/summary': { body: makeSummary() },
}

describe('login and protected routes', () => {
  it('redirects unauthenticated users from a protected route to login', async () => {
    mockApi({})
    renderApp('/friends')
    expect(await screen.findByRole('heading', { name: 'Masuk sebagai bendahara' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('validates the form before calling the API', async () => {
    const { calls } = mockApi({})
    renderApp('/login')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(screen.getByText('Email wajib diisi.')).toBeInTheDocument()
    expect(screen.getByText('Kata sandi wajib diisi.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Email/), 'bukan-email')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(screen.getByText('Format email tidak valid.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('shows an error for wrong credentials and stays on the login page', async () => {
    mockApi({ 'POST /auth/login': apiError(401, 'invalid_credentials') })
    renderApp('/login')
    await userEvent.type(screen.getByLabelText(/Email/), 'bendahara@example.com')
    await userEvent.type(screen.getByLabelText(/Kata sandi/), 'salah')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau kata sandi salah.')
    expect(session.getToken()).toBeNull()
  })

  it('logs in, stores only the token, and returns to the originally requested page', async () => {
    const { calls } = mockApi({
      'POST /auth/login': { body: { access_token: 'jwt-1', token_type: 'bearer', expires_in: 3600 } },
      ...dashboardRoutes,
      'GET /friends': { body: page([]) },
    })
    renderApp('/friends')
    await userEvent.type(await screen.findByLabelText(/Email/), 'bendahara@example.com')
    await userEvent.type(screen.getByLabelText(/Kata sandi/), 'rahasia123')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(await screen.findByRole('heading', { name: 'Teman' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/friends')
    expect(calls[0].body).toEqual({ email: 'bendahara@example.com', password: 'rahasia123' })
    expect(session.getToken()).toBe('jwt-1')
    expect(JSON.stringify(sessionStorage)).not.toContain('rahasia123')
    expect(localStorage.length).toBe(0)
  })

  it('redirects to the dashboard after a plain login', async () => {
    mockApi({
      'POST /auth/login': { body: { access_token: 'jwt-1', token_type: 'bearer', expires_in: 3600 } },
      ...dashboardRoutes,
    })
    renderApp('/login')
    await userEvent.type(screen.getByLabelText(/Email/), 'bendahara@example.com')
    await userEvent.type(screen.getByLabelText(/Kata sandi/), 'rahasia123')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByRole('heading', { name: 'Halo, Bendahara' })).toBeInTheDocument()
  })

  it('clears the session and redirects to login when the API returns 401', async () => {
    mockApi({ ...dashboardRoutes, 'GET /friends': apiError(401, 'not_authenticated') })
    renderApp('/friends', { loggedIn: true })
    expect(await screen.findByRole('heading', { name: 'Masuk sebagai bendahara' })).toBeInTheDocument()
    expect(session.getToken()).toBeNull()
  })

  it('renders the dashboard with backend summary totals', async () => {
    mockApi({
      'GET /auth/me': { body: user },
      'GET /events': {
        body: page([makeEvent(), makeEvent({ id: 'e-2', title: 'Kado Sari', status: 'completed' })]),
      },
      'GET /events/e-1/summary': { body: makeSummary() },
      'GET /events/e-2/summary': {
        body: makeSummary({ event_id: 'e-2', total_collected: 500_000, total_pending: 0, total_participants: 5 }),
      },
    })
    renderApp('/', { loggedIn: true })
    expect(await screen.findByText('Rp700.000')).toBeInTheDocument() // 200.000 + 500.000
    expect(screen.getByText('Rp150.000')).toBeInTheDocument()
    // Active events: 1; participants counted for active events only: 2.
    const stat = (label: string) => screen.getByText(label).parentElement!
    expect(stat('Acara aktif')).toHaveTextContent('1')
    expect(stat('Peserta (acara aktif)')).toHaveTextContent('2')
    expect(screen.getByText('Kado Sari')).toBeInTheDocument()
  })

  it('logs out and returns to login', async () => {
    mockApi(dashboardRoutes)
    renderApp('/', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Keluar' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'))
    expect(session.getToken()).toBeNull()
  })
})
