import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { apiError, makeFriend, mockApi, page, renderApp, user } from '@/test/utils'

describe('friends management', () => {
  it('lists friends with a loading state first', async () => {
    mockApi({ 'GET /auth/me': { body: user }, 'GET /friends': { body: page([makeFriend()]) } })
    renderApp('/friends', { loggedIn: true })
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
    expect(screen.getByText('+62 812-3456-7890')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockApi({ 'GET /auth/me': { body: user }, 'GET /friends': { body: page([]) } })
    renderApp('/friends', { loggedIn: true })
    expect(await screen.findByText('Belum ada teman')).toBeInTheDocument()
  })

  it('sends the search term to the backend', async () => {
    const { calls } = mockApi({ 'GET /auth/me': { body: user }, 'GET /friends': { body: page([]) } })
    renderApp('/friends', { loggedIn: true })
    await screen.findByText('Belum ada teman')
    await userEvent.type(screen.getByLabelText('Cari teman'), 'budi')
    await waitFor(() => expect(calls.some((c) => c.query.get('search') === 'budi')).toBe(true))
    expect(await screen.findByText('Tidak ada teman yang cocok')).toBeInTheDocument()
  })

  it('creates a friend with validation', async () => {
    const { calls, routes } = mockApi({
      'GET /auth/me': { body: user },
      'GET /friends': { body: page([]) },
      'POST /friends': { status: 201, body: makeFriend({ id: 'f-9', name: 'Dewi', nickname: null, phone: null }) },
    })
    renderApp('/friends', { loggedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: 'Tambah teman' }))[0])
    const dialog = await screen.findByRole('dialog', { name: 'Tambah teman' })
    await userEvent.type(within(dialog).getByLabelText(/Nomor telepon/), 'abc')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah teman' }))
    expect(within(dialog).getByText('Nama wajib diisi.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Nomor telepon tidak valid/)).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText(/Nama lengkap/), '  Dewi ')
    await userEvent.clear(within(dialog).getByLabelText(/Nomor telepon/))
    routes['GET /friends'] = { body: page([makeFriend({ id: 'f-9', name: 'Dewi', nickname: null, phone: null })]) }
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tambah teman' }))

    expect(await screen.findByText('Dewi')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST' && c.path === '/friends')?.body).toEqual({ name: 'Dewi', nickname: null, phone: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('edits a friend', async () => {
    const { calls } = mockApi({
      'GET /auth/me': { body: user },
      'GET /friends': { body: page([makeFriend()]) },
      'PATCH /friends/f-1': { body: makeFriend({ nickname: 'Bud' }) },
    })
    renderApp('/friends', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Ubah Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ubah data teman' })
    const nickname = within(dialog).getByLabelText(/Nama panggilan/)
    await userEvent.clear(nickname)
    await userEvent.type(nickname, 'Bud')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Simpan perubahan' }))
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        name: 'Budi Santoso',
        nickname: 'Bud',
        phone: '+62 812-3456-7890',
      }),
    )
  })

  it('explains when a friend with contribution history cannot be deleted', async () => {
    mockApi({
      'GET /auth/me': { body: user },
      'GET /friends': { body: page([makeFriend()]) },
      'DELETE /friends/f-1': apiError(409, 'friend_in_use', 'in use', { contributions: 3 }),
    })
    renderApp('/friends', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus Budi Santoso' }))
    const dialog = await screen.findByRole('dialog', { name: 'Hapus teman?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hapus teman' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('tercatat di 3 iuran acara')
    expect(screen.getByText('Budi Santoso', { selector: 'span' })).toBeInTheDocument()
  })

  it('deletes a friend the backend allows to delete', async () => {
    const { calls, routes } = mockApi({
      'GET /auth/me': { body: user },
      'GET /friends': { body: page([makeFriend()]) },
      'DELETE /friends/f-1': { status: 204 },
    })
    renderApp('/friends', { loggedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Hapus Budi Santoso' }))
    routes['GET /friends'] = { body: page([]) }
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hapus teman' }))
    expect(await screen.findByText('Belum ada teman')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE')).toBe(true)
  })
})
