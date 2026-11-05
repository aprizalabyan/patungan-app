import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  apiError,
  makeContribution,
  makeEvent,
  makeFriend,
  makeSummary,
  mockApi,
  page,
  renderApp,
  user,
} from '@/test/utils'

describe('event list', () => {
  it('shows a loading state, then events with backend summary values', async () => {
    mockApi({
      'GET /auth/me': { body: user },
      'GET /events': { body: page([makeEvent()]) },
      'GET /events/e-1/summary': { body: makeSummary() },
    })
    renderApp('/events', { loggedIn: true })
    expect(await screen.findByRole('link', { name: 'Kado Rina & Dimas' })).toBeInTheDocument()
    expect(screen.getByText('12 Desember 2026')).toBeInTheDocument()
    expect(screen.getByText('Publik')).toBeInTheDocument()
    expect(await screen.findByText('Rp200.000')).toBeInTheDocument()
  })

  it('passes the status filter to the backend', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /events': { body: page([]) },
    })
    renderApp('/events', { loggedIn: true })
    await screen.findByText('Belum ada acara')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'completed')
    await waitFor(() => expect(calls.some((c) => c.path === '/events' && c.query.get('status') === 'completed')).toBe(true))
    expect(await screen.findByText('Tidak ada acara dengan status ini')).toBeInTheDocument()
  })

  it('shows an error state with retry', async () => {
    mockApi({ 'GET /auth/me': { body: user }, 'GET /events': apiError(500, 'internal') })
    renderApp('/events', { loggedIn: true })
    expect(await screen.findByText('Gagal memuat data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
  })

  it('creates an event after validating required fields', async () => {
    const created = makeEvent({ id: 'e-9', title: 'Kado Sari', target_amount: 1_500_000 })
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /events': { body: page([]) },
      'POST /events': { status: 201, body: created },
      'GET /events/e-9': { body: created },
      'GET /events/e-9/summary': { body: makeSummary({ event_id: 'e-9', total_participants: 0 }) },
      'GET /events/e-9/contributions': { body: page([]) },
    })
    renderApp('/events', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Buat acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buat acara baru' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat acara' }))
    expect(within(dialog).getByText('Judul acara wajib diisi.')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Judul acara/), 'Kado Sari')
    await userEvent.type(within(dialog).getByLabelText(/Target dana/), '1500000')
    expect(within(dialog).getByLabelText(/Target dana/)).toHaveValue('1.500.000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat acara' }))

    expect(await screen.findByRole('heading', { name: 'Kado Sari' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/events')?.body).toEqual({
      title: 'Kado Sari',
      description: null,
      event_date: null,
      target_amount: 1_500_000,
      status: 'active',
      is_public: true,
    })
  })
})

function detailRoutes(contributions = [makeContribution()]) {
  return {
    'GET /auth/me': { body: user },
    'GET /events/e-1': { body: makeEvent() },
    'GET /events/e-1/summary': { body: makeSummary() },
    'GET /events/e-1/contributions': { body: page(contributions, contributions.length, 1, 100) },
  }
}

describe('event detail', () => {
  it('shows event info, backend summary and participants', async () => {
    mockApi(detailRoutes([makeContribution(), makeContribution({ id: 'c-2', friend_id: 'f-2', friend: { id: 'f-2', name: 'Citra', nickname: null }, payment_status: 'paid', paid_at: '2026-10-20T03:00:00Z', amount: 200_000 })]))
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByRole('heading', { name: 'Kado Rina & Dimas' })).toBeInTheDocument()
    expect(screen.getByText('Rp2.000.000')).toBeInTheDocument()
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuetext', '10%')
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('20 Okt 2026, 10.00 WIB')).toBeInTheDocument()
  })

  it('shows not-found state for a missing event', async () => {
    mockApi({
      'GET /auth/me': { body: user },
      'GET /events/e-x': apiError(404, 'not_found'),
      'GET /events/e-x/summary': apiError(404, 'not_found'),
      'GET /events/e-x/contributions': apiError(404, 'not_found'),
    })
    renderApp('/events/e-x', { loggedIn: true })
    expect(await screen.findByText('Acara tidak ditemukan')).toBeInTheDocument()
  })

  it('shows an empty participant state', async () => {
    mockApi(detailRoutes([]))
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByText('Belum ada peserta')).toBeInTheDocument()
  })

  it('edits event details with PATCH', async () => {
    const { calls, routes } = mockApi({
      ...detailRoutes(),
      'PATCH /events/e-1': (call) => ({ body: makeEvent(call.body as object) }),
      'GET /events': { body: page([]) },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah acara' })
    const title = within(dialog).getByLabelText(/Judul acara/)
    expect(title).toHaveValue('Kado Rina & Dimas')
    await userEvent.clear(title)
    await userEvent.type(title, 'Kado Rina')
    await userEvent.click(within(dialog).getByLabelText(/Tampilkan di halaman publik/))
    routes['GET /events/e-1'] = { body: makeEvent({ title: 'Kado Rina', is_public: false }) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))

    expect(await screen.findByRole('heading', { name: 'Kado Rina' })).toBeInTheDocument()
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.body).toMatchObject({ title: 'Kado Rina', is_public: false, target_amount: 2_000_000 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/tautan publik tidak tersedia/)).toBeInTheDocument()
  })

  it('adds a friend as a new pending contribution and refreshes list and summary', async () => {
    const added = makeContribution({ id: 'c-2', friend_id: 'f-2', friend: { id: 'f-2', name: 'Citra Lestari', nickname: 'Citra' }, amount: 200_000 })
    const { calls, routes } = mockApi({
      ...detailRoutes(),
      'GET /friends': { body: page([makeFriend(), makeFriend({ id: 'f-2', name: 'Citra Lestari', nickname: 'Citra' })]) },
      'POST /events/e-1/contributions': { status: 201, body: added },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await screen.findByText('Budi Santoso')
    await userEvent.click(screen.getAllByRole('button', { name: 'Tambah peserta' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Tambah peserta' })

    // Budi is already in the event.
    expect(await within(dialog).findByText('Sudah terdaftar')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah peserta' }))
    expect(within(dialog).getByText('Pilih satu teman.')).toBeInTheDocument()
    expect(within(dialog).getByText('Nominal iuran wajib diisi.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('radio', { name: /Citra Lestari/ }))
    await userEvent.type(within(dialog).getByLabelText(/Nominal iuran/), '200000')

    const summaryCallsBefore = calls.filter((c) => c.path === '/events/e-1/summary').length
    routes['GET /events/e-1/contributions'] = { body: page([makeContribution(), added], 2, 1, 100) }
    routes['GET /events/e-1/summary'] = { body: makeSummary({ total_participants: 3, total_pending: 350_000 }) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah peserta' }))

    expect(await screen.findByText('Citra Lestari')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/events/e-1/contributions')?.body).toEqual({ friend_id: 'f-2', amount: 200_000, notes: null })
    expect(await screen.findByText('Rp350.000')).toBeInTheDocument()
    expect(calls.filter((c) => c.path === '/events/e-1/summary').length).toBeGreaterThan(summaryCallsBefore)
  })

  it('shows the duplicate-contribution error from the backend', async () => {
    mockApi({
      ...detailRoutes([]),
      'GET /friends': { body: page([makeFriend()]) },
      'POST /events/e-1/contributions': apiError(409, 'duplicate_contribution'),
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Tambah peserta' }))[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('radio', { name: /Budi Santoso/ }))
    await userEvent.type(within(dialog).getByLabelText(/Nominal iuran/), '100000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah peserta' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Teman ini sudah terdaftar di acara ini.')
  })

  it('marks a contribution as paid and invalidates contributions and summary', async () => {
    const paid = makeContribution({ payment_status: 'paid', paid_at: '2026-10-30T05:00:00Z' })
    const { calls, routes } = mockApi({
      ...detailRoutes(),
      'PATCH /contributions/c-1': { body: paid },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await screen.findByText('Budi Santoso')
    const countOf = (path: string) => calls.filter((c) => c.method === 'GET' && c.path === path).length
    const before = { summary: countOf('/events/e-1/summary'), list: countOf('/events/e-1/contributions') }

    routes['GET /events/e-1/contributions'] = { body: page([paid], 1, 1, 100) }
    routes['GET /events/e-1/summary'] = { body: makeSummary({ paid_count: 2, pending_count: 0, total_collected: 350_000, total_pending: 0 }) }
    await userEvent.click(screen.getByRole('button', { name: 'Tandai lunas: Budi Santoso' }))

    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ payment_status: 'paid' })
    expect(await screen.findByText('30 Okt 2026, 12.00 WIB')).toBeInTheDocument()
    expect(await screen.findByText('Rp350.000')).toBeInTheDocument()
    expect(countOf('/events/e-1/summary')).toBeGreaterThan(before.summary)
    expect(countOf('/events/e-1/contributions')).toBeGreaterThan(before.list)
  })

  it('asks for confirmation before reverting a paid contribution', async () => {
    const paid = makeContribution({ payment_status: 'paid', paid_at: '2026-10-30T05:00:00Z' })
    const { calls } = mockApi({
      ...detailRoutes([paid]),
      'PATCH /contributions/c-1': { body: makeContribution() },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Tandai belum bayar: Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Batalkan status lunas?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batal' }))
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Tandai belum bayar: Budi Santoso' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ya, batalkan lunas' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ payment_status: 'pending' }))
  })

  it('removes a contribution only after confirmation', async () => {
    const { calls, routes } = mockApi({ ...detailRoutes(), 'DELETE /contributions/c-1': { status: 204 } })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus Budi Santoso dari acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hapus peserta?' })
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false)
    routes['GET /events/e-1/contributions'] = { body: page([], 0, 1, 100) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus peserta' }))
    expect(await screen.findByText('Belum ada peserta')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/contributions/c-1')).toBe(true)
  })

  it('edits amount and notes', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      'PATCH /contributions/c-1': { body: makeContribution({ amount: 175_000, notes: 'transfer BCA' }) },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah iuran Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah iuran' })
    const amount = within(dialog).getByLabelText(/Nominal iuran/)
    await userEvent.clear(amount)
    await userEvent.type(amount, '0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(within(dialog).getByText('Nominal iuran harus lebih dari Rp0.')).toBeInTheDocument()
    await userEvent.clear(amount)
    await userEvent.type(amount, '175000')
    await userEvent.type(within(dialog).getByLabelText(/Catatan/), 'transfer BCA')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ amount: 175_000, notes: 'transfer BCA' }),
    )
  })
})
