import { describe, expect, it } from 'vitest'
import { makeContribution, makeEvent, makeSummary } from '@/test/utils'
import { buildWhatsAppSummary } from './whatsapp'

describe('buildWhatsAppSummary', () => {
  it('uses backend totals and lists paid/pending participants', () => {
    const text = buildWhatsAppSummary(
      makeEvent(),
      makeSummary(),
      [
        makeContribution(),
        makeContribution({ id: 'c-2', friend: { id: 'f-2', name: 'Citra', nickname: null }, payment_status: 'paid' }),
      ],
      'https://patungan.test/public/events/e-1',
    )
    expect(text).toContain('*Kado Rina & Dimas*')
    expect(text).toContain('Tanggal: 12 Desember 2026')
    expect(text).toContain('Terkumpul: Rp200.000')
    expect(text).toContain('Progres: 10%')
    expect(text).toContain('1. Citra')
    expect(text).toContain('1. Budi Santoso — Rp150.000')
    expect(text).toContain('https://patungan.test/public/events/e-1')
  })

  it('omits the link for private events', () => {
    const text = buildWhatsAppSummary(makeEvent({ is_public: false }), makeSummary(), [], null)
    expect(text).not.toContain('Cek status')
  })
})
