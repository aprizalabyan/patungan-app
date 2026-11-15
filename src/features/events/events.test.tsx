import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  apiError,
  makeContribution,
  makeEvent,
  makeFriend,
  makeSummary,
  makePaymentAccount,
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
    expect(await screen.findByRole('button', { name: 'Detail Kado Rina & Dimas' })).toBeInTheDocument()
    expect(screen.getByText('12 Desember 2026')).toBeInTheDocument()
    expect(screen.getByText('Publik')).toBeInTheDocument()
    expect(await screen.findByText('Rp200.000')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Detail Kado Rina & Dimas' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/events/e-1')
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
      payment_mode: 'track_status',
    })
  })

  it('sends the selected paid_only mode when creating an event', async () => {
    const created = makeEvent({ id: 'e-paid', title: 'Kado Lunas', payment_mode: 'paid_only' })
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /events': { body: page([]) },
      'POST /events': { status: 201, body: created },
      'GET /events/e-paid': { body: created },
      'GET /events/e-paid/summary': { body: makeSummary({ event_id: 'e-paid', total_participants: 0 }) },
      'GET /events/e-paid/contributions': { body: page([]) },
    })
    renderApp('/events', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Buat acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Buat acara baru' })
    await userEvent.type(within(dialog).getByLabelText(/Judul acara/), 'Kado Lunas')
    await userEvent.click(within(dialog).getByRole('radio', { name: /Catat yang sudah lunas saja/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Buat acara' }))
    await screen.findByRole('heading', { name: 'Kado Lunas' })
    expect(calls.find((call) => call.method === 'POST' && call.path === '/events')?.body).toMatchObject({
      title: 'Kado Lunas', payment_mode: 'paid_only',
    })
  })
})

function detailRoutes(contributions = [makeContribution()]) {
  return {
    'GET /auth/me': { body: user },
    'GET /events/e-1': { body: makeEvent() },
    'GET /events/e-1/summary': { body: makeSummary() },
    'GET /events/e-1/contributions': { body: page(contributions, contributions.length, 1, 100) },
    'GET /events/e-1/payment-accounts': { body: [] },
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

  it('locks the payment mode when an event already has contributions', async () => {
    mockApi(detailRoutes())
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah acara' })
    expect(within(dialog).getByRole('radio', { name: /Catat yang sudah lunas saja/ })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Pantau status pembayaran/ })).toBeDisabled()
  })

  it('creates paid_only contributions with payment details in one request', async () => {
    const account = makePaymentAccount()
    const paidEvent = makeEvent({ payment_mode: 'paid_only' })
    const paidRow = makeContribution({ payment_status: 'paid', paid_at: '2026-11-15T07:00:00Z', payment_account: {
      id: account.id, type: account.type, provider_name: account.provider_name, account_name: account.account_name, account_number: account.account_number, label: account.label,
    } })
    const { calls, routes } = mockApi({
      ...detailRoutes([]),
      'GET /events/e-1': { body: paidEvent },
      'GET /events/e-1/payment-accounts': { body: [account] },
      'GET /events/e-1/summary': { body: makeSummary({ total_participants: 0, paid_count: 0, pending_count: 0, total_contributions: 0, total_received: 0, total_collected: 0, total_pending: 0 }) },
      'GET /friends': { body: page([makeFriend()]) },
      'POST /events/e-1/contributions': { status: 201, body: paidRow },
    })
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByText('Catat yang sudah lunas saja')).toBeInTheDocument()
    const summary = await screen.findByRole('region', { name: 'Ringkasan keuangan' })
    expect(within(summary).queryByText('Belum dibayar')).not.toBeInTheDocument()
    await userEvent.click((await screen.findAllByRole('button', { name: 'Catat iuran' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Catat iuran' })
    expect(await within(dialog).findByLabelText(/Rekening tujuan/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('radio', { name: /Budi Santoso/ }))
    await userEvent.type(within(dialog).getByLabelText(/Nominal iuran/), '150000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat iuran' }))
    expect(within(dialog).getByText('Pilih rekening tujuan.')).toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText(/Rekening tujuan/), account.id)
    await userEvent.type(within(dialog).getByLabelText(/Catatan pembayaran/), 'Transfer')
    routes['GET /events/e-1/contributions'] = { body: page([paidRow]) }
    routes['GET /events/e-1/summary'] = { body: makeSummary({ paid_count: 1, pending_count: 0, total_participants: 1, total_contributions: paidRow.amount, total_received: paidRow.amount, total_collected: paidRow.amount, total_pending: 0 }) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat iuran' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/contributions'))?.body).toMatchObject({
      friend_id: 'f-1', amount: 150_000, payment_account_id: account.id,
      paid_at: expect.stringMatching(/\+07:00$/), payment_notes: 'Transfer',
    }))
    expect(await screen.findByText(/berhasil dicatat dan berstatus lunas/)).toBeInTheDocument()
    expect(await screen.findAllByText('Rp150.000')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Catat pembayaran Budi Santoso' })).not.toBeInTheDocument()
    expect(calls.some((c) => c.path.endsWith('/payment') && c.method === 'PATCH')).toBe(false)
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
    routes['GET /events/e-1/summary'] = { body: makeSummary({ total_participants: 3, total_contributions: 550_000, total_pending: 350_000 }) }
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

  it('sends only the changed field and never payment_status when editing a contribution', async () => {
    const { calls } = mockApi({
      ...detailRoutes(),
      'PATCH /contributions/c-1': { body: makeContribution({ notes: 'catatan baru' }) },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah iuran Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah iuran' })
    await userEvent.type(within(dialog).getByLabelText(/Catatan/), 'catatan baru')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ notes: 'catatan baru' }))
  })

  it('filters participants by pending and paid only', async () => {
    mockApi(
      detailRoutes([
        makeContribution({ payment_status: 'paid', paid_at: '2026-11-15T07:00:00Z' }),
        makeContribution({ id: 'c-2', friend_id: 'f-2', friend: { id: 'f-2', name: 'Citra', nickname: null } }),
      ]),
    )
    renderApp('/events/e-1', { loggedIn: true })
    await screen.findByText('Budi Santoso')
    const filters = screen.getByRole('group', { name: 'Saring status pembayaran' })
    expect(within(filters).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Semua',
      'Belum bayar',
      'Lunas',
    ])
    expect(screen.queryByText('Sebagian')).not.toBeInTheDocument()
    await userEvent.click(within(filters).getByRole('button', { name: 'Lunas' }))
    expect(screen.queryByText('Citra')).not.toBeInTheDocument()
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  })

  it('locks the amount of a paid contribution and sends only the notes', async () => {
    const { calls } = mockApi({
      ...detailRoutes([makeContribution({ payment_status: 'paid', paid_at: '2026-11-15T07:00:00Z' })]),
      'PATCH /contributions/c-1': { body: makeContribution({ notes: 'catatan' }) },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah iuran Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah iuran' })
    expect(within(dialog).getByLabelText(/Nominal iuran/)).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Catatan/), 'catatan')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ notes: 'catatan' }))
    expect(screen.queryByRole('dialog', { name: 'Konfirmasi perubahan nominal?' })).not.toBeInTheDocument()
  })

  it('edits a paid_only amount after confirmation while preserving payment metadata', async () => {
    const paid = makeContribution({
      payment_status: 'paid',
      paid_at: '2026-11-15T07:00:00Z',
      payment_account: {
        id: 'a-1', type: 'bank', provider_name: 'BRI', account_name: 'Aprizal', account_number: '0012345678', label: null,
      },
      payment_notes: 'Transfer awal',
    })
    const { calls, routes } = mockApi({
      ...detailRoutes([paid]),
      'GET /events/e-1': { body: makeEvent({ payment_mode: 'paid_only' }) },
      'GET /events/e-1/summary': { body: makeSummary({ total_participants: 1, paid_count: 1, pending_count: 0, total_contributions: paid.amount, total_received: paid.amount, total_collected: paid.amount, total_pending: 0 }) },
      'PATCH /contributions/c-1': { body: makeContribution({ ...paid, amount: 175_000 }) },
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah iuran Budi Santoso' }))
    const editDialog = await screen.findByRole('dialog', { name: 'Ubah iuran' })
    const amount = within(editDialog).getByLabelText(/Nominal iuran/)
    expect(amount).toBeEnabled()
    await userEvent.clear(amount)
    await userEvent.type(amount, '175000')
    await userEvent.click(within(editDialog).getByRole('button', { name: 'Simpan' }))

    const confirm = await screen.findByRole('dialog', { name: 'Konfirmasi perubahan nominal?' })
    expect(calls.some((call) => call.method === 'PATCH' && call.path === '/contributions/c-1')).toBe(false)
    expect(within(confirm).getByText(/rekening, dan waktu pembayaran akan tetap dipertahankan/)).toBeInTheDocument()
    routes['GET /events/e-1/contributions'] = { body: page([makeContribution({ ...paid, amount: 175_000 })]) }
    routes['GET /events/e-1/summary'] = { body: makeSummary({ total_participants: 1, paid_count: 1, pending_count: 0, total_contributions: 175_000, total_received: 175_000, total_collected: 175_000, total_pending: 0 }) }
    await userEvent.click(within(confirm).getByRole('button', { name: 'Simpan perubahan' }))

    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH' && call.path === '/contributions/c-1')?.body).toEqual({ amount: 175_000 }))
    expect(await screen.findByText('Lunas')).toBeInTheDocument()
    expect(await screen.findByText('15 Nov 2026, 14.00 WIB')).toBeInTheDocument()
    expect(await screen.findByText('0012345678')).toBeInTheDocument()
    const summary = await screen.findByRole('region', { name: 'Ringkasan keuangan' })
    expect(within(summary).getAllByText('Rp175.000').length).toBeGreaterThan(0)
    expect(calls.find((call) => call.method === 'PATCH' && call.path === '/contributions/c-1')?.body).not.toHaveProperty('paid_at')
    expect(calls.find((call) => call.method === 'PATCH' && call.path === '/contributions/c-1')?.body).not.toHaveProperty('payment_account_id')
  })

  it('explains that a contribution with payments cannot be deleted', async () => {
    mockApi({
      ...detailRoutes(),
      'DELETE /contributions/c-1': apiError(409, 'contribution_has_payments'),
    })
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus Budi Santoso dari acara' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hapus peserta?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus peserta' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('pembayaran yang dibatalkan')
  })
})
