import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { FriendFormDialog } from '@/features/friends/FriendFormDialog'
import { useCreateFriend, useDeleteFriend, useFriendsList, useUpdateFriend } from '@/features/friends/useFriends'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePageParam, useSearchParamState } from '@/hooks/usePageParam'
import { ApiError, getErrorMessage } from '@/services/errors'
import type { Friend } from '@/types/api'

const PAGE_SIZE = 20

function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'friend_in_use') {
    const count = (error.details as { contributions?: number } | null)?.contributions
    return count
      ? `Teman ini tercatat di ${count} iuran acara, sehingga tidak dapat dihapus demi menjaga riwayat keuangan.`
      : 'Teman ini memiliki riwayat iuran, sehingga tidak dapat dihapus demi menjaga riwayat keuangan.'
  }
  return getErrorMessage(error, 'Gagal menghapus teman.')
}

export function FriendsPage() {
  const toast = useToast()
  const [page, setPage] = usePageParam()
  const [search, setSearch] = useSearchParamState('search')
  const [input, setInput] = useState(search)
  const debounced = useDebouncedValue(input.trim(), 300)
  useEffect(() => {
    if (debounced !== search) setSearch(debounced)
  }, [debounced, search, setSearch])

  const friends = useFriendsList({ search: search || undefined, page, page_size: PAGE_SIZE })
  const createFriend = useCreateFriend()
  const updateFriend = useUpdateFriend()
  const deleteFriend = useDeleteFriend()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Friend | undefined>()
  const [deleting, setDeleting] = useState<Friend | null>(null)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const columns: Column<Friend>[] = [
    {
      key: 'name',
      header: 'Nama',
      hideMobileLabel: true,
      cell: (f) => <span className="font-medium text-stone-900">{f.name}</span>,
    },
    { key: 'nickname', header: 'Panggilan', cell: (f) => f.nickname ?? '-' },
    { key: 'phone', header: 'Telepon', className: 'whitespace-nowrap', cell: (f) => f.phone ?? '-' },
    {
      key: 'actions',
      header: 'Aksi',
      hideMobileLabel: true,
      className: 'md:text-right',
      cell: (f) => (
        <div className="flex gap-2 pt-1 md:justify-end md:pt-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(f)
              setFormOpen(true)
            }}
            aria-label={`Ubah ${f.name}`}
          >
            Ubah
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            onClick={() => setDeleting(f)}
            aria-label={`Hapus ${f.name}`}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Teman"
        description="Daftar induk teman yang bisa diikutkan ke berbagai acara. Teman tidak perlu memiliki akun."
        actions={<Button onClick={openCreate}>Tambah teman</Button>}
      />

      <Card>
        <div className="border-b border-stone-100 p-4">
          <TextField
            label="Cari teman"
            type="search"
            placeholder="Nama, panggilan, atau nomor telepon…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>

        {friends.isPending ? (
          <LoadingState />
        ) : friends.isError ? (
          <ErrorState error={friends.error} onRetry={() => void friends.refetch()} />
        ) : friends.data.items.length === 0 ? (
          search ? (
            <EmptyState title="Tidak ada teman yang cocok" description={`Tidak ditemukan hasil untuk "${search}".`} />
          ) : (
            <EmptyState
              title="Belum ada teman"
              description="Tambahkan teman SMA yang akan ikut patungan."
              action={<Button onClick={openCreate}>Tambah teman</Button>}
            />
          )
        ) : (
          <DataTable caption="Daftar teman" columns={columns} rows={friends.data.items} rowKey={(f) => f.id} />
        )}

        {friends.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={friends.data.total} onPageChange={setPage} />
        )}
      </Card>

      <FriendFormDialog
        open={formOpen}
        friend={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={async (body) => {
          if (editing) {
            await updateFriend.mutateAsync({ id: editing.id, body })
            toast.success('Data teman diperbarui.')
          } else {
            await createFriend.mutateAsync(body)
            toast.success('Teman berhasil ditambahkan.')
          }
          setFormOpen(false)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Hapus teman?"
        message={
          deleting && (
            <>
              <strong>{deleting.name}</strong> akan dihapus dari daftar teman. Teman yang sudah pernah ikut iuran tidak
              dapat dihapus.
            </>
          )
        }
        confirmLabel="Hapus teman"
        loading={deleteFriend.isPending}
        error={deleteFriend.isError ? deleteErrorMessage(deleteFriend.error) : null}
        onCancel={() => {
          setDeleting(null)
          deleteFriend.reset()
        }}
        onConfirm={() => {
          if (!deleting) return
          deleteFriend.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.name} dihapus.`)
              setDeleting(null)
            },
          })
        }}
      />
    </>
  )
}
