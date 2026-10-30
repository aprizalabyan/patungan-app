import type { Contribution, Event, EventSummary } from '@/types/api'
import { formatDate, formatRupiah } from './format'

/**
 * Builds a WhatsApp-ready text (uses WhatsApp *bold* markup). All totals come
 * from the backend summary; the participant list is only listed, never summed.
 */
export function buildWhatsAppSummary(
  event: Event,
  summary: EventSummary,
  contributions: Contribution[],
  publicUrl: string | null,
): string {
  const lines: string[] = [`*${event.title}*`]
  if (event.event_date) lines.push(`Tanggal: ${formatDate(event.event_date)}`)
  lines.push('')
  if (summary.target_amount) lines.push(`Target: ${formatRupiah(summary.target_amount)}`)
  lines.push(`Terkumpul: ${formatRupiah(summary.total_collected)}`)
  if (summary.progress_percent !== null) lines.push(`Progres: ${summary.progress_percent}%`)
  lines.push(`Belum masuk: ${formatRupiah(summary.total_pending)}`)
  lines.push(
    `Peserta: ${summary.total_participants} (${summary.paid_count} lunas, ${summary.pending_count} belum bayar)`,
  )

  const paid = contributions.filter((c) => c.payment_status === 'paid')
  const pending = contributions.filter((c) => c.payment_status === 'pending')
  if (paid.length) {
    lines.push('', '*Sudah bayar* ✅')
    paid.forEach((c, i) => lines.push(`${i + 1}. ${c.friend.name}`))
  }
  if (pending.length) {
    lines.push('', '*Belum bayar* ⏳')
    pending.forEach((c, i) => lines.push(`${i + 1}. ${c.friend.name} — ${formatRupiah(c.amount)}`))
  }
  if (publicUrl) lines.push('', `Cek status terbaru: ${publicUrl}`)
  lines.push('', 'Terima kasih! 🙏')
  return lines.join('\n')
}
