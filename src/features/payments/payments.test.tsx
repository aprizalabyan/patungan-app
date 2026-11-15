import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  apiError,
  makeContribution,
  makeEvent,
  makePaymentAccount,
  makeSummary,
  mockApi,
  page,
  renderApp,
  user,
} from '@/test/utils'

const bri = makePaymentAccount()
const dana = makePaymentAccount({
  id: 'a-2',
  type: 'e_wallet',
  provider_name: 'DANA',
  account_name: 'Aprizal',
  account_number: '081234567890',
})
const shopee = makePaymentAccount({
  id: 'a-3',
  type: 'e_wallet',
  provider_name: 'ShopeePay',
  account_number: '085500001111',
  is_active: false,
})

// --- Payment accounts page ---------------------------------------------------------

describe('payment accounts page', () => {
  const base = { 'GET /auth/me': { body: user } }

  it('lists accounts with type, owner, number and an inactive marker', async () => {
    mockApi({ ...base, 'GET /payment-accounts': { body: [bri, dana, shopee] } })
    renderApp('/payment-accounts', { loggedIn: true })
    expect(await screen.findByText('BRI')).toBeInTheDocument()
    expect(screen.getByText('0012345678')).toBeInTheDocument() // leading zero kept
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.getAllByText('E-wallet')).toHaveLength(2)
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Aktifkan rekening ShopeePay/ })).toBeInTheDocument()
  })

  it('shows empty and error states', async () => {
    mockApi({ ...base, 'GET /payment-accounts': { body: [] } })
    const { unmount } = renderApp('/payment-accounts', { loggedIn: true })
    expect(await screen.findByText('Belum ada rekening')).toBeInTheDocument()
    unmount()

    mockApi({ ...base, 'GET /payment-accounts': apiError(500, 'internal') })
    renderApp('/payment-accounts', { loggedIn: true })
    expect(await screen.findByText('Gagal memuat data')).toBeInTheDocument()
  })

  it('validates and creates an account, keeping the number as a string', async () => {
    const created = makePaymentAccount({ id: 'a-9', provider_name: 'BSI', account_number: '0098765' })
    const { calls, routes } = mockApi({
      ...base,
      'GET /payment-accounts': { body: [] },
      'POST /payment-accounts': { status: 201, body: created },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Tambah rekening' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Tambah rekening' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah rekening' }))
    expect(within(dialog).getByText('Nama penyedia wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText('Nama pemilik wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText('Nomor rekening wajib diisi.')).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/payment-accounts' && c.method === 'POST')).toBe(false)

    await userEvent.type(within(dialog).getByLabelText(/Nama penyedia/), 'BSI')
    await userEvent.type(within(dialog).getByLabelText(/Nama pemilik/), 'Aprizal')
    await userEvent.type(within(dialog).getByLabelText(/Nomor rekening/), '0098765')
    routes['GET /payment-accounts'] = { body: [created] }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah rekening' }))

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST' && c.path === '/payment-accounts')?.body).toEqual({
        type: 'bank',
        provider_name: 'BSI',
        account_name: 'Aprizal',
        account_number: '0098765',
        label: null,
      }),
    )
    expect(await screen.findByText('0098765')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits only the changed fields', async () => {
    const { calls } = mockApi({
      ...base,
      'GET /payment-accounts': { body: [bri] },
      'PATCH /payment-accounts/a-1': { body: { ...bri, label: 'Utama' } },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Ubah rekening BRI/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah rekening' })
    expect(within(dialog).getByLabelText(/Nomor rekening/)).toHaveValue('0012345678')
    await userEvent.type(within(dialog).getByLabelText('Label'), 'Utama')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ label: 'Utama' }))
  })

  it('asks for confirmation before deactivating, and offers no delete', async () => {
    const { calls } = mockApi({
      ...base,
      'GET /payment-accounts': { body: [bri] },
      'PATCH /payment-accounts/a-1/status': { body: { ...bri, is_active: false } },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    expect(screen.queryByRole('button', { name: /Hapus/ })).not.toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: /Nonaktifkan rekening BRI/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Nonaktifkan rekening?' })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Nonaktifkan' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ is_active: false }))
  })

  it('activates an inactive account directly', async () => {
    const { calls } = mockApi({
      ...base,
      'GET /payment-accounts': { body: [shopee] },
      'PATCH /payment-accounts/a-3/status': { body: { ...shopee, is_active: true } },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Aktifkan rekening ShopeePay/ }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ is_active: true }))
  })
})

// --- Event payment accounts ----------------------------------------------------------

function eventRoutes(extra: Record<string, unknown> = {}) {
  return {
    'GET /auth/me': { body: user },
    'GET /events/e-1': { body: makeEvent() },
    'GET /events/e-1/summary': { body: makeSummary() },
    'GET /events/e-1/contributions': { body: page([makeContribution()], 1, 1, 100) },
    'GET /events/e-1/payment-accounts': { body: [bri] },
    'GET /payment-accounts': { body: [bri, dana, shopee] },
    ...extra,
  } as Parameters<typeof mockApi>[0]
}

describe('event payment accounts', () => {
  it('shows the empty state when no account is offered', async () => {
    mockApi(eventRoutes({ 'GET /events/e-1/payment-accounts': { body: [] } }))
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByText('Belum ada rekening untuk acara ini')).toBeInTheDocument()
  })

  it('flags an inactive account that is still linked to the event', async () => {
    mockApi(eventRoutes({ 'GET /events/e-1/payment-accounts': { body: [bri, shopee] } }))
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByText('ShopeePay')).toBeInTheDocument()
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0)
  })

  it('saves the selection with PUT and never sends inactive accounts', async () => {
    const { calls } = mockApi(
      eventRoutes({
        'GET /events/e-1/payment-accounts': { body: [bri, shopee] },
        'PUT /events/e-1/payment-accounts': { body: [bri, dana] },
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Atur rekening' }))
    const dialog = await screen.findByRole('dialog', { name: 'Atur rekening acara' })
    const boxes = await within(dialog).findAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    expect(boxes[0]).toBeChecked() // BRI
    expect(boxes[1]).not.toBeChecked() // DANA
    expect(boxes[2]).toBeDisabled() // ShopeePay is inactive, so it cannot be selected
    expect(boxes[2]).not.toBeChecked()
    expect(within(dialog).getByText(/akan dilepas dari acara ini/)).toBeInTheDocument()

    await userEvent.click(boxes[1])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan rekening' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ payment_account_ids: ['a-1', 'a-2'] }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('explains a rejected selection inside the dialog', async () => {
    mockApi(
      eventRoutes({
        'PUT /events/e-1/payment-accounts': apiError(409, 'payment_account_inactive'),
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Atur rekening' }))
    const dialog = await screen.findByRole('dialog', { name: 'Atur rekening acara' })
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Simpan rekening' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('sudah nonaktif')
  })
})

// --- Event summary ---------------------------------------------------------------------

describe('event summary', () => {
  it('shows backend totals, paid/pending counts and the receipts breakdown including unassigned', async () => {
    mockApi(
      eventRoutes({
        'GET /events/e-1/summary': {
          body: makeSummary({
            total_participants: 4,
            paid_count: 2,
            pending_count: 2,
            total_contributions: 640_000,
            total_received: 450_000,
            total_collected: 450_000,
            total_pending: 190_000,
            unassigned_total: 25_000,
            payment_accounts: [
              { id: 'a-1', provider_name: 'BRI', type: 'bank', total_received: 300_000 },
              { id: 'a-2', provider_name: 'DANA', type: 'e_wallet', total_received: 125_000 },
            ],
          }),
        },
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    const region = await screen.findByRole('region', { name: 'Ringkasan keuangan' })
    expect(within(region).getByText('Total tagihan').nextSibling).toHaveTextContent('Rp640.000')
    expect(within(region).getByText('Total diterima').nextSibling).toHaveTextContent('Rp450.000')
    expect(within(region).getByText('Belum dibayar').nextSibling).toHaveTextContent('Rp190.000')
    expect(within(region).getByText('Lunas').nextSibling).toHaveTextContent('2')
    expect(within(region).getByText('Belum bayar').nextSibling).toHaveTextContent('2')
    expect(within(region).getByText('Penerimaan per rekening')).toBeInTheDocument()
    expect(within(region).getByText('Rp300.000')).toBeInTheDocument()
    expect(within(region).getByText('Rp125.000')).toBeInTheDocument()
    expect(within(region).getByText('Rekening tidak tercatat')).toBeInTheDocument()
    expect(within(region).getByText('Rp25.000')).toBeInTheDocument()
    // Nothing from the old multi-payment model is left.
    for (const gone of ['Sisa tagihan', 'Kelebihan bayar', 'Sebagian']) {
      expect(within(region).queryByText(gone)).not.toBeInTheDocument()
    }
  })
})

// --- The single contribution payment -------------------------------------------------------

const snapshot = {
  id: 'a-1',
  type: 'bank' as const,
  provider_name: 'BRI',
  account_name: 'Aprizal',
  account_number: '0012345678',
  label: null,
}
const pending = makeContribution()
const paid = makeContribution({
  payment_status: 'paid',
  paid_at: '2026-11-15T07:00:00Z',
  payment_account: snapshot,
  payment_notes: 'Transfer mobile banking',
})

function paymentRoutes(contribution = pending, extra: Record<string, unknown> = {}) {
  return eventRoutes({
    'GET /events/e-1/contributions': { body: page([contribution], 1, 1, 100) },
    'GET /events/e-1/payment-accounts': { body: [bri, dana, shopee] },
    ...extra,
  })
}

async function openPending() {
  await userEvent.click(await screen.findByRole('button', { name: 'Catat pembayaran Budi Santoso' }))
  return screen.findByRole('dialog', { name: 'Catat pembayaran' })
}

async function openPaid() {
  await userEvent.click(await screen.findByRole('button', { name: 'Lihat pembayaran Budi Santoso' }))
  return screen.findByRole('dialog', { name: 'Pembayaran' })
}

const countGets = (calls: { method: string; path: string }[], path: string) =>
  calls.filter((c) => c.method === 'GET' && c.path === path).length

describe('recording the payment of a pending contribution', () => {
  it('shows the bill read-only and only the active accounts of the event', async () => {
    mockApi(paymentRoutes())
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()

    expect(within(dialog).getByText('Nominal tagihan').nextSibling).toHaveTextContent('Rp150.000')
    const amount = await within(dialog).findByLabelText('Nominal pembayaran')
    expect(amount).toHaveValue('Rp150.000')
    expect(amount).toHaveAttribute('readonly')

    const select = await within(dialog).findByLabelText(/Rekening tujuan/)
    expect(within(select).queryByRole('option', { name: /ShopeePay/ })).not.toBeInTheDocument()
    expect(within(select).getAllByRole('option')).toHaveLength(3) // placeholder + BRI + DANA
  })

  it('requires an account, sends no amount, and shows the paid state afterwards', async () => {
    const recorded = makeContribution({
      payment_status: 'paid',
      paid_at: '2026-11-15T07:00:00Z',
      payment_account: { ...snapshot, id: 'a-2', type: 'e_wallet', provider_name: 'DANA', account_number: '081234567890' },
      payment_notes: 'via DANA',
    })
    const { calls, routes } = mockApi(paymentRoutes(pending, { 'PATCH /contributions/c-1/payment': { body: recorded } }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()

    await userEvent.click(await within(dialog).findByRole('button', { name: 'Catat pembayaran' }))
    expect(within(dialog).getByText('Pilih rekening tujuan.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)

    await userEvent.selectOptions(within(dialog).getByLabelText(/Rekening tujuan/), 'a-2')
    await userEvent.type(within(dialog).getByLabelText('Catatan'), 'via DANA')

    const before = {
      list: countGets(calls, '/events/e-1/contributions'),
      summary: countGets(calls, '/events/e-1/summary'),
    }
    routes['GET /events/e-1/contributions'] = { body: page([recorded], 1, 1, 100) }
    routes['GET /events/e-1/summary'] = {
      body: makeSummary({ paid_count: 2, pending_count: 0, total_received: 350_000, total_collected: 350_000, total_pending: 0 }),
    }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat pembayaran' }))

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({
        path: '/contributions/c-1/payment',
        body: {
          payment_account_id: 'a-2',
          paid_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+07:00$/),
          notes: 'via DANA',
        },
      }),
    )
    // The payment equals the bill, so no amount (and no status) is ever sent.
    expect(calls.find((c) => c.method === 'PATCH')?.body).not.toHaveProperty('amount')
    expect(calls.find((c) => c.method === 'PATCH')?.body).not.toHaveProperty('payment_status')

    expect(await screen.findByText('Pembayaran dicatat.')).toBeInTheDocument()
    const paidDialog = await screen.findByRole('dialog', { name: 'Pembayaran' })
    expect(within(paidDialog).getByText('Lunas')).toBeInTheDocument()
    expect(within(paidDialog).getByText('DANA')).toBeInTheDocument()
    expect(within(paidDialog).getByText('081234567890')).toBeInTheDocument()
    expect(within(paidDialog).getByText('15 Nov 2026, 14.00 WIB')).toBeInTheDocument()
    expect(within(paidDialog).getByText('via DANA')).toBeInTheDocument()
    // No way to record again.
    expect(within(paidDialog).queryByRole('button', { name: 'Catat pembayaran' })).not.toBeInTheDocument()
    expect(within(paidDialog).queryByLabelText(/Rekening tujuan/)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(countGets(calls, '/events/e-1/contributions')).toBeGreaterThan(before.list)
      expect(countGets(calls, '/events/e-1/summary')).toBeGreaterThan(before.summary)
    })
  })

  it('omits empty notes from the request', async () => {
    const { calls } = mockApi(paymentRoutes(pending, { 'PATCH /contributions/c-1/payment': { body: paid } }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Rekening tujuan/), 'a-1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat pembayaran' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).not.toHaveProperty('notes'))
  })

  it('disables recording and explains when no active account is offered', async () => {
    mockApi(paymentRoutes(pending, { 'GET /events/e-1/payment-accounts': { body: [shopee] } }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()
    expect(await within(dialog).findByText(/Belum ada rekening aktif untuk acara ini/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Catat pembayaran' })).toBeDisabled()
  })

  it('shows an error with retry when the event accounts cannot be loaded', async () => {
    mockApi(paymentRoutes(pending, { 'GET /events/e-1/payment-accounts': apiError(500, 'internal') }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()
    expect(await within(dialog).findByText(/Gagal memuat rekening acara/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
  })

  it('explains backend rejections of the account', async () => {
    mockApi(paymentRoutes(pending, { 'PATCH /contributions/c-1/payment': apiError(409, 'payment_account_not_available') }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Rekening tujuan/), 'a-1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat pembayaran' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('tidak tersedia untuk acara ini')
  })

  it('refreshes the row when another session already recorded the payment (409)', async () => {
    const { calls, routes } = mockApi(
      paymentRoutes(pending, { 'PATCH /contributions/c-1/payment': apiError(409, 'contribution_already_paid') }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPending()
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Rekening tujuan/), 'a-1')
    const before = countGets(calls, '/events/e-1/contributions')
    routes['GET /events/e-1/contributions'] = { body: page([paid], 1, 1, 100) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat pembayaran' }))
    await waitFor(() => expect(countGets(calls, '/events/e-1/contributions')).toBeGreaterThan(before))
    // The dialog now follows the live row: paid, so there is nothing left to record.
    const next = await screen.findByRole('dialog', { name: 'Pembayaran' })
    expect(within(next).queryByRole('button', { name: 'Catat pembayaran' })).not.toBeInTheDocument()
  })
})

describe('a paid contribution', () => {
  it('shows the stored account snapshot, date and notes, and offers no second payment', async () => {
    mockApi(
      paymentRoutes(paid, {
        // The account was renamed later; the contribution keeps what was copied when it was paid.
        'GET /events/e-1/payment-accounts': { body: [{ ...bri, account_name: 'Nama Baru' }, dana] },
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByRole('button', { name: 'Lihat pembayaran Budi Santoso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Catat pembayaran Budi Santoso' })).not.toBeInTheDocument()
    const dialog = await openPaid()

    expect(within(dialog).getByText('Lunas')).toBeInTheDocument()
    expect(within(dialog).getByText('BRI')).toBeInTheDocument()
    expect(within(dialog).getByText(/^Aprizal ·/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/Nama Baru/)).not.toBeInTheDocument()
    expect(within(dialog).getByText('0012345678')).toBeInTheDocument()
    expect(within(dialog).getByText('15 Nov 2026, 14.00 WIB')).toBeInTheDocument()
    expect(within(dialog).getByText('Transfer mobile banking')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Catat pembayaran' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Batalkan pembayaran' })).toBeInTheDocument()
  })

  it('labels a legacy payment without an account', async () => {
    mockApi(paymentRoutes({ ...paid, payment_account: null, payment_notes: null }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPaid()
    expect(within(dialog).getByText('Rekening tidak tercatat')).toBeInTheDocument()
  })

  it('cancels only after confirmation, sending the optional reason, and returns to pending', async () => {
    const { calls, routes } = mockApi(
      paymentRoutes(paid, { 'POST /contributions/c-1/payment/cancel': { body: pending } }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPaid()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan pembayaran' }))
    const confirm = await screen.findByRole('dialog', { name: 'Batalkan pembayaran?' })
    expect(calls.some((c) => c.path.endsWith('/payment/cancel'))).toBe(false)

    await userEvent.type(within(confirm).getByLabelText(/Alasan pembatalan/), 'Salah rekening')
    const before = {
      list: countGets(calls, '/events/e-1/contributions'),
      summary: countGets(calls, '/events/e-1/summary'),
    }
    routes['GET /events/e-1/contributions'] = { body: page([pending], 1, 1, 100) }
    routes['GET /events/e-1/summary'] = {
      body: makeSummary({ paid_count: 0, pending_count: 2, total_received: 0, total_collected: 0, total_pending: 350_000 }),
    }
    await userEvent.click(within(confirm).getByRole('button', { name: 'Batalkan pembayaran' }))

    await waitFor(() =>
      expect(calls.find((c) => c.path === '/contributions/c-1/payment/cancel')).toMatchObject({
        method: 'POST',
        body: { reason: 'Salah rekening' },
      }),
    )
    expect(await screen.findByText(/Pembayaran dibatalkan/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The row is pending again: status, no payment info and a way to record once more.
    expect(await screen.findByRole('button', { name: 'Catat pembayaran Budi Santoso' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lihat pembayaran Budi Santoso' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(countGets(calls, '/events/e-1/contributions')).toBeGreaterThan(before.list)
      expect(countGets(calls, '/events/e-1/summary')).toBeGreaterThan(before.summary)
    })
  })

  it('cancels without a body when no reason is given', async () => {
    const { calls } = mockApi(paymentRoutes(paid, { 'POST /contributions/c-1/payment/cancel': { body: pending } }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPaid()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan pembayaran' }))
    const confirm = await screen.findByRole('dialog', { name: 'Batalkan pembayaran?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Batalkan pembayaran' }))
    await waitFor(() => expect(calls.some((c) => c.path === '/contributions/c-1/payment/cancel')).toBe(true))
    expect(calls.find((c) => c.path === '/contributions/c-1/payment/cancel')?.body).toBeUndefined()
  })

  it('keeps the payment and shows the error when cancelling fails', async () => {
    mockApi(paymentRoutes(paid, { 'POST /contributions/c-1/payment/cancel': apiError(409, 'contribution_not_paid') }))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPaid()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan pembayaran' }))
    const confirm = await screen.findByRole('dialog', { name: 'Batalkan pembayaran?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Batalkan pembayaran' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('belum memiliki pembayaran')
  })

  it('can back out of the cancel confirmation without changing anything', async () => {
    const { calls } = mockApi(paymentRoutes(paid))
    renderApp('/events/e-1', { loggedIn: true })
    const dialog = await openPaid()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Batalkan pembayaran' }))
    const confirm = await screen.findByRole('dialog', { name: 'Batalkan pembayaran?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Kembali' }))
    expect(await screen.findByRole('dialog', { name: 'Pembayaran' })).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cancel'))).toBe(false)
  })
})

// --- Cash accounts ---------------------------------------------------------------------------

const cash = makePaymentAccount({
  id: 'a-cash',
  type: 'cash',
  provider_name: 'Cash',
  account_name: 'Bendahara',
  account_number: null,
})

describe('cash accounts', () => {
  it('lists cash as its own type, without a number', async () => {
    mockApi({ 'GET /auth/me': { body: user }, 'GET /payment-accounts': { body: [bri, cash] } })
    renderApp('/payment-accounts', { loggedIn: true })
    expect(await screen.findByText('Tunai')).toBeInTheDocument()
    expect(screen.getByText('Bank')).toBeInTheDocument()
    expect(screen.getByText('Dipegang oleh Bendahara')).toBeInTheDocument()
  })

  it('hides provider and number for cash and sends neither', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /payment-accounts': { body: [] },
      'POST /payment-accounts': { status: 201, body: cash },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Tambah rekening' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Tambah rekening' })
    expect(within(dialog).getByLabelText(/Nama penyedia/)).toBeInTheDocument()

    await userEvent.selectOptions(within(dialog).getByLabelText(/Jenis rekening/), 'cash')
    expect(within(dialog).queryByLabelText(/Nama penyedia/)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Nomor rekening/)).not.toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah rekening' }))
    expect(within(dialog).getByText('Nama pemegang kas wajib diisi.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/payment-accounts')).toBe(false)

    await userEvent.type(within(dialog).getByLabelText(/Nama pemegang kas/), 'Bendahara')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah rekening' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST' && c.path === '/payment-accounts')?.body).toEqual({
        type: 'cash',
        account_name: 'Bendahara',
        label: null,
      }),
    )
  })

  it('keeps provider and number for bank and e-wallet', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /payment-accounts': { body: [] },
      'POST /payment-accounts': { status: 201, body: dana },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Tambah rekening' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Tambah rekening' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Jenis rekening/), 'e_wallet')
    await userEvent.type(within(dialog).getByLabelText(/Nama penyedia/), 'DANA')
    await userEvent.type(within(dialog).getByLabelText(/Nama pemilik/), 'Aprizal')
    await userEvent.type(within(dialog).getByLabelText(/Nomor rekening/), '081234567890')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah rekening' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST' && c.path === '/payment-accounts')?.body).toEqual({
        type: 'e_wallet',
        provider_name: 'DANA',
        account_name: 'Aprizal',
        account_number: '081234567890',
        label: null,
      }),
    )
  })

  it('edits a cash account without sending provider or number', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /payment-accounts': { body: [cash] },
      'PATCH /payment-accounts/a-cash': { body: { ...cash, label: 'Kas utama' } },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Ubah rekening Cash Bendahara/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah rekening' })
    await userEvent.type(within(dialog).getByLabelText('Label'), 'Kas utama')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ label: 'Kas utama' }))
  })

  it('requires provider and number again when switching cash to bank', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /payment-accounts': { body: [cash] },
      'PATCH /payment-accounts/a-cash': { body: bri },
    })
    renderApp('/payment-accounts', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Ubah rekening Cash Bendahara/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah rekening' })
    await userEvent.selectOptions(within(dialog).getByLabelText(/Jenis rekening/), 'bank')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
    expect(within(dialog).getByText('Nama penyedia wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText('Nomor rekening wajib diisi.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/Nama penyedia/), 'BRI')
    await userEvent.type(within(dialog).getByLabelText(/Nomor rekening/), '0012345678')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        type: 'bank',
        provider_name: 'BRI',
        account_number: '0012345678',
      }),
    )
  })

  it('offers cash for the event and as a payment destination, then shows the cash snapshot', async () => {
    const recorded = makeContribution({
      payment_status: 'paid',
      paid_at: '2026-11-15T07:00:00Z',
      payment_account: {
        id: 'a-cash',
        type: 'cash',
        provider_name: 'Cash',
        account_name: 'Bendahara',
        account_number: null,
        label: null,
      },
    })
    const { calls, routes } = mockApi(
      eventRoutes({
        'GET /events/e-1/payment-accounts': { body: [bri, cash] },
        'GET /payment-accounts': { body: [bri, cash] },
        'PATCH /contributions/c-1/payment': { body: recorded },
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    expect(await screen.findByText('Tunai')).toBeInTheDocument() // event account card

    await userEvent.click(await screen.findByRole('button', { name: 'Catat pembayaran Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Catat pembayaran' })
    const select = await within(dialog).findByLabelText(/Rekening tujuan/)
    expect(within(select).getByRole('option', { name: 'Tunai — Bendahara' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'a-cash')
    routes['GET /events/e-1/contributions'] = { body: page([recorded], 1, 1, 100) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Catat pembayaran' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ payment_account_id: 'a-cash' }),
    )

    const paidDialog = await screen.findByRole('dialog', { name: 'Pembayaran' })
    expect(within(paidDialog).getByText('Tunai')).toBeInTheDocument()
    expect(within(paidDialog).getByText('Dipegang oleh Bendahara')).toBeInTheDocument()
    expect(within(paidDialog).queryByText('null')).not.toBeInTheDocument()
  })

  it('shows cash in the summary breakdown', async () => {
    mockApi(
      eventRoutes({
        'GET /events/e-1/summary': {
          body: makeSummary({
            payment_accounts: [
              { id: 'a-1', provider_name: 'BRI', type: 'bank', total_received: 100_000 },
              { id: 'a-cash', provider_name: 'Cash', type: 'cash', total_received: 75_000 },
            ],
          }),
        },
      }),
    )
    renderApp('/events/e-1', { loggedIn: true })
    const region = await screen.findByRole('region', { name: 'Ringkasan keuangan' })
    expect(within(region).getByText('Cash')).toBeInTheDocument()
    expect(within(region).getByText('Tunai')).toBeInTheDocument()
    expect(within(region).getByText('Rp75.000')).toBeInTheDocument()
  })
})
