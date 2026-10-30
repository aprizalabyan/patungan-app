import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EventStatusBadge, VisibilityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { SelectField, TextField } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { EventFormDialog } from '@/features/events/EventFormDialog'
import { useCreateEvent, useEventSummaries, useEventsList } from '@/features/events/useEvents'
import { usePageParam, useSearchParamState } from '@/hooks/usePageParam'
import type { Event, EventStatus } from '@/types/api'
import { formatDate, formatRupiah } from '@/utils/format'

const PAGE_SIZE = 10

export function EventsPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [page, setPage] = usePageParam()
  const [status, setStatus] = useSearchParamState('status')
  const [isNew, setIsNew] = useSearchParamState('new')
  const [search, setSearch] = useState('')

  const statusFilter = status === 'active' || status === 'completed' ? (status as EventStatus) : undefined
  const events = useEventsList({ page, page_size: PAGE_SIZE, status: statusFilter })
  const createEvent = useCreateEvent()

  const pageItems = useMemo(() => events.data?.items ?? [], [events.data])
  // The backend `/events` endpoint has no text search; we filter the current page only.
  const term = search.trim().toLowerCase()
  const visible = term ? pageItems.filter((e) => e.title.toLowerCase().includes(term)) : pageItems
  const summaries = useEventSummaries(useMemo(() => pageItems.map((e) => e.id), [pageItems]))

  const columns: Column<Event>[] = [
    {
      key: 'title',
      header: 'Acara',
      hideMobileLabel: true,
      cell: (e) => (
        <Link to={`/events/${e.id}`} className="font-medium text-stone-900 hover:text-green-700 hover:underline">
          {e.title}
        </Link>
      ),
    },
    { key: 'date', header: 'Tanggal', className: 'whitespace-nowrap', cell: (e) => formatDate(e.event_date) },
    { key: 'status', header: 'Status', cell: (e) => <EventStatusBadge status={e.status} /> },
    { key: 'visibility', header: 'Visibilitas', cell: (e) => <VisibilityBadge isPublic={e.is_public} /> },
    {
      key: 'participants',
      header: 'Peserta',
      className: 'tabular-nums md:text-right',
      cell: (e) => summaries.byId.get(e.id)?.total_participants ?? '…',
    },
    {
      key: 'collected',
      header: 'Terkumpul',
      className: 'tabular-nums whitespace-nowrap md:text-right',
      cell: (e) => {
        const s = summaries.byId.get(e.id)
        return s ? formatRupiah(s.total_collected) : '…'
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Acara"
        description="Semua patungan yang Anda kelola."
        actions={<Button onClick={() => setIsNew('1', false)}>Buat acara</Button>}
      />

      <Card>
        <div className="grid gap-3 border-b border-stone-100 p-4 sm:grid-cols-[1fr_200px]">
          <TextField
            label="Cari judul"
            type="search"
            placeholder="Cari di halaman ini…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            hint={term ? 'Pencarian berlaku pada halaman yang sedang ditampilkan.' : undefined}
          />
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="completed">Selesai</option>
          </SelectField>
        </div>

        {events.isPending ? (
          <LoadingState />
        ) : events.isError ? (
          <ErrorState error={events.error} onRetry={() => void events.refetch()} />
        ) : events.data.total === 0 ? (
          statusFilter ? (
            <EmptyState title="Tidak ada acara dengan status ini" />
          ) : (
            <EmptyState
              title="Belum ada acara"
              description="Buat acara pertama untuk mulai mencatat iuran."
              action={<Button onClick={() => setIsNew('1', false)}>Buat acara</Button>}
            />
          )
        ) : visible.length === 0 ? (
          <EmptyState title="Tidak ada acara yang cocok" description="Coba kata kunci lain atau pindah halaman." />
        ) : (
          <DataTable caption="Daftar acara" columns={columns} rows={visible} rowKey={(e) => e.id} />
        )}

        {events.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={events.data.total} onPageChange={setPage} />
        )}
      </Card>

      <EventFormDialog
        open={isNew === '1'}
        onClose={() => setIsNew('', false)}
        onSubmit={async (body) => {
          const created = await createEvent.mutateAsync(body)
          toast.success('Acara berhasil dibuat.')
          navigate(`/events/${created.id}`)
        }}
      />
    </>
  )
}
