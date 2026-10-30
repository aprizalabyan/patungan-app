import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EventStatusBadge, VisibilityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingState } from '@/components/ui/Spinner'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AddContributionDialog } from '@/features/events/AddContributionDialog'
import { ContributionsTable } from '@/features/events/ContributionsTable'
import { EditContributionDialog } from '@/features/events/EditContributionDialog'
import { EventFormDialog } from '@/features/events/EventFormDialog'
import { EventSummaryPanel } from '@/features/events/EventSummaryPanel'
import {
  useAddContribution,
  useAllContributions,
  useDeleteContribution,
  useDeleteEvent,
  useEvent,
  useEventSummary,
  useUpdateContribution,
  useUpdateEvent,
} from '@/features/events/useEvents'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { getErrorMessage, isNotFound } from '@/services/errors'
import type { Contribution, PaymentStatus } from '@/types/api'
import { cn } from '@/utils/cn'
import { formatDate, formatRupiah } from '@/utils/format'
import { publicEventPath, publicEventUrl } from '@/utils/publicUrl'
import { buildWhatsAppSummary } from '@/utils/whatsapp'

type Filter = 'all' | PaymentStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Belum bayar' },
  { value: 'paid', label: 'Lunas' },
]

export function EventDetailPage() {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const copy = useCopyToClipboard()

  const event = useEvent(eventId)
  const summary = useEventSummary(eventId)
  const contributions = useAllContributions(eventId)

  const updateEvent = useUpdateEvent(eventId)
  const deleteEvent = useDeleteEvent()
  const addContribution = useAddContribution(eventId)
  const updateContribution = useUpdateContribution(eventId)
  const deleteContribution = useDeleteContribution(eventId)

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Contribution | null>(null)
  const [removing, setRemoving] = useState<Contribution | null>(null)
  const [unpaying, setUnpaying] = useState<Contribution | null>(null)
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const allContributions = useMemo(() => contributions.data?.items ?? [], [contributions.data])
  const existingFriendIds = useMemo(() => new Set(allContributions.map((c) => c.friend_id)), [allContributions])
  const visible = filter === 'all' ? allContributions : allContributions.filter((c) => c.payment_status === filter)
  const statusPendingId = updateContribution.isPending ? (updateContribution.variables?.id ?? null) : null

  async function setStatus(c: Contribution, next: PaymentStatus) {
    try {
      await updateContribution.mutateAsync({ id: c.id, body: { payment_status: next } })
      toast.success(
        next === 'paid' ? `${c.friend.name} ditandai lunas.` : `${c.friend.name} ditandai belum bayar.`,
      )
    } catch (err) {
      toast.error(getErrorMessage(err, 'Gagal memperbarui status pembayaran.'))
    }
  }

  function handleToggle(c: Contribution, next: PaymentStatus) {
    // Reverting a payment clears paid_at on the backend, so ask first.
    if (next === 'pending') setUnpaying(c)
    else void setStatus(c, next)
  }

  if (event.isPending) return <LoadingState />
  if (event.isError) {
    return (
      <Card>
        {isNotFound(event.error) ? (
          <EmptyState
            title="Acara tidak ditemukan"
            description="Acara ini mungkin sudah dihapus atau tautannya keliru."
            action={
              <Link to="/events" className="font-medium text-green-700 hover:underline">
                Kembali ke daftar acara
              </Link>
            }
          />
        ) : (
          <ErrorState error={event.error} onRetry={() => void event.refetch()} />
        )}
      </Card>
    )
  }

  const e = event.data
  const shareUrl = e.is_public ? publicEventUrl(e.id) : null

  return (
    <>
      <PageHeader
        breadcrumb={
          <Link to="/events" className="text-stone-500 hover:text-green-700">
            ← Daftar acara
          </Link>
        }
        title={e.title}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <span>{formatDate(e.event_date)}</span>
            <EventStatusBadge status={e.status} />
            <VisibilityBadge isPublic={e.is_public} />
          </div>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Ubah acara
            </Button>
            <Button variant="danger" onClick={() => setConfirmDeleteEvent(true)}>
              Hapus
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <Card className="p-4 sm:p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-line text-stone-800">{e.description || '-'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Target dana</dt>
              <dd className="mt-1 font-medium text-stone-900">
                {e.target_amount ? formatRupiah(e.target_amount) : 'Tanpa target'}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
            {shareUrl ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void copy(shareUrl, 'Tautan publik disalin.')}>
                  Salin tautan publik
                </Button>
                <Link
                  to={publicEventPath(e.id)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-8 items-center px-2 text-sm font-medium text-green-700 hover:underline"
                >
                  Buka halaman publik ↗
                </Link>
              </>
            ) : (
              <p className="text-sm text-stone-500">
                Acara ini privat; tautan publik tidak tersedia. Ubah visibilitas menjadi publik untuk membagikannya.
              </p>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={!summary.data || !contributions.data}
              onClick={() =>
                summary.data &&
                void copy(
                  buildWhatsAppSummary(e, summary.data, allContributions, shareUrl),
                  'Ringkasan WhatsApp disalin.',
                )
              }
            >
              Salin ringkasan WhatsApp
            </Button>
          </div>
        </Card>

        {summary.isPending ? (
          <LoadingState label="Memuat ringkasan…" />
        ) : summary.isError ? (
          <Card>
            <ErrorState error={summary.error} title="Gagal memuat ringkasan" onRetry={() => void summary.refetch()} />
          </Card>
        ) : (
          <EventSummaryPanel summary={summary.data} />
        )}

        <Card>
          <CardHeader
            title="Peserta"
            description="Iuran baru selalu berstatus belum bayar."
            actions={<Button onClick={() => setAddOpen(true)}>Tambah peserta</Button>}
          />
          {contributions.isPending ? (
            <LoadingState label="Memuat peserta…" />
          ) : contributions.isError ? (
            <ErrorState error={contributions.error} onRetry={() => void contributions.refetch()} />
          ) : allContributions.length === 0 ? (
            <EmptyState
              title="Belum ada peserta"
              description="Tambahkan teman dari daftar teman untuk mulai mencatat iuran."
              action={<Button onClick={() => setAddOpen(true)}>Tambah peserta</Button>}
            />
          ) : (
            <>
              <div role="group" aria-label="Saring status pembayaran" className="flex gap-1 border-b border-stone-100 px-4 py-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      'rounded-full px-3 py-1 text-sm',
                      filter === f.value ? 'bg-green-700 text-white' : 'text-stone-600 hover:bg-stone-100',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <EmptyState title="Tidak ada peserta dengan status ini" />
              ) : (
                <ContributionsTable
                  contributions={visible}
                  pendingId={statusPendingId}
                  onToggleStatus={handleToggle}
                  onEdit={setEditing}
                  onDelete={setRemoving}
                />
              )}
            </>
          )}
        </Card>
      </div>

      <EventFormDialog
        open={editOpen}
        event={e}
        onClose={() => setEditOpen(false)}
        onSubmit={async (body) => {
          await updateEvent.mutateAsync(body)
          toast.success('Acara berhasil diperbarui.')
          setEditOpen(false)
        }}
      />

      <AddContributionDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existingFriendIds={existingFriendIds}
        onSubmit={async (body) => {
          const created = await addContribution.mutateAsync(body)
          toast.success(`${created.friend.name} ditambahkan ke acara.`)
          setAddOpen(false)
        }}
      />

      <EditContributionDialog
        contribution={editing}
        onClose={() => setEditing(null)}
        onSubmit={async (id, body) => {
          await updateContribution.mutateAsync({ id, body })
          toast.success('Iuran berhasil diperbarui.')
          setEditing(null)
        }}
      />

      <ConfirmDialog
        open={unpaying !== null}
        title="Batalkan status lunas?"
        message={
          unpaying && (
            <>
              Status <strong>{unpaying.friend.name}</strong> akan kembali menjadi belum bayar dan waktu pembayaran akan
              dihapus.
            </>
          )
        }
        confirmLabel="Ya, batalkan lunas"
        tone="primary"
        loading={updateContribution.isPending}
        onCancel={() => setUnpaying(null)}
        onConfirm={async () => {
          if (!unpaying) return
          await setStatus(unpaying, 'pending')
          setUnpaying(null)
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Hapus peserta?"
        message={
          removing && (
            <>
              Iuran <strong>{removing.friend.name}</strong> ({formatRupiah(removing.amount)}) akan dihapus dari acara
              ini. Data teman di daftar teman tidak terhapus.
            </>
          )
        }
        confirmLabel="Hapus peserta"
        loading={deleteContribution.isPending}
        error={deleteContribution.isError ? getErrorMessage(deleteContribution.error) : null}
        onCancel={() => {
          setRemoving(null)
          deleteContribution.reset()
        }}
        onConfirm={() => {
          if (!removing) return
          deleteContribution.mutate(removing.id, {
            onSuccess: () => {
              toast.success(`${removing.friend.name} dihapus dari acara.`)
              setRemoving(null)
            },
          })
        }}
      />

      <ConfirmDialog
        open={confirmDeleteEvent}
        title="Hapus acara ini?"
        message={
          <>
            Acara <strong>{e.title}</strong> beserta <strong>seluruh data iurannya</strong> akan dihapus permanen. Tindakan
            ini tidak dapat dibatalkan.
          </>
        }
        confirmLabel="Hapus permanen"
        loading={deleteEvent.isPending}
        error={deleteEvent.isError ? getErrorMessage(deleteEvent.error) : null}
        onCancel={() => {
          setConfirmDeleteEvent(false)
          deleteEvent.reset()
        }}
        onConfirm={() =>
          deleteEvent.mutate(e.id, {
            onSuccess: () => {
              toast.success('Acara dihapus.')
              navigate('/events', { replace: true })
            },
          })
        }
      />
    </>
  )
}
