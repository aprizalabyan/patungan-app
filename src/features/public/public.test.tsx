import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { apiError, makeSummary, mockApi, renderApp } from '@/test/utils'

const publicEvent = {
  id: 'e-1',
  title: 'Kado Rina & Dimas',
  description: 'Patungan kado pernikahan',
  event_date: '2026-12-12',
  target_amount: 2_000_000,
  status: 'active',
  participants: [
    { name: 'Budi Santoso', payment_status: 'paid' },
    { name: 'Citra Lestari', payment_status: 'pending' },
  ],
}

describe('public event page', () => {
  it('is accessible without login and never sends credentials', async () => {
    const { calls } = mockApi({
      'GET /public/events/e-1': { body: publicEvent },
      'GET /public/events/e-1/summary': { body: makeSummary() },
    })
    renderApp('/public/events/e-1')

    expect(await screen.findByRole('heading', { name: 'Kado Rina & Dimas' })).toBeInTheDocument()
    expect(screen.getByText('12 Desember 2026')).toBeInTheDocument()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('Lunas')).toBeInTheDocument()
    expect(screen.getByText('Belum bayar')).toBeInTheDocument()
    expect(await screen.findByText('Rp200.000')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '10%')
    expect(screen.getByText('Hanya baca')).toBeInTheDocument()

    expect(screen.getByTestId('location')).toHaveTextContent('/public/events/e-1')
    expect(calls.every((c) => c.path.startsWith('/public/'))).toBe(true)
    expect(calls.every((c) => !c.headers.Authorization)).toBe(true)
  })

  it('offers no management actions', async () => {
    mockApi({
      'GET /public/events/e-1': { body: publicEvent },
      'GET /public/events/e-1/summary': { body: makeSummary() },
    })
    renderApp('/public/events/e-1')
    await screen.findByRole('heading', { name: 'Kado Rina & Dimas' })
    expect(screen.queryByRole('button', { name: /Tandai|Hapus|Ubah|Tambah/ })).not.toBeInTheDocument()
  })

  it('shows an unavailable state for private or missing events', async () => {
    mockApi({
      'GET /public/events/e-x': apiError(404, 'not_found'),
      'GET /public/events/e-x/summary': apiError(404, 'not_found'),
    })
    renderApp('/public/events/e-x')
    expect(await screen.findByText('Acara tidak tersedia')).toBeInTheDocument()
  })

  it('shows an empty state when there are no participants', async () => {
    mockApi({
      'GET /public/events/e-1': { body: { ...publicEvent, participants: [] } },
      'GET /public/events/e-1/summary': { body: makeSummary({ total_participants: 0, progress_percent: null }) },
    })
    renderApp('/public/events/e-1')
    expect(await screen.findByText('Belum ada peserta')).toBeInTheDocument()
  })
})
