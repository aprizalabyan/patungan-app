import { describe, expect, it } from 'vitest'
import { formatAmountInput, formatDate, formatDateTime, formatRupiah, parseRupiahInput } from './format'

describe('formatRupiah', () => {
  it('formats whole Rupiah with dot separators and no space', () => {
    expect(formatRupiah(200_000)).toBe('Rp200.000')
    expect(formatRupiah(1_500_000)).toBe('Rp1.500.000')
    expect(formatRupiah(0)).toBe('Rp0')
  })
})

describe('formatDate', () => {
  it('formats a backend date in Indonesian without timezone shift', () => {
    expect(formatDate('2026-12-12')).toBe('12 Desember 2026')
    expect(formatDate('2026-01-01')).toBe('1 Januari 2026')
  })

  it('returns a dash for empty or invalid values', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('')).toBe('-')
    expect(formatDate('kemarin')).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('formats UTC timestamps in WIB', () => {
    // 07:30 UTC = 14:30 WIB
    expect(formatDateTime('2026-12-12T07:30:00Z')).toMatch(/^12 Des 2026,? 14[.:]30 WIB$/)
  })

  it('returns a dash for null', () => {
    expect(formatDateTime(null)).toBe('-')
  })
})

describe('amount input helpers', () => {
  it('parses formatted input into integers', () => {
    expect(parseRupiahInput('200.000')).toBe(200_000)
    expect(parseRupiahInput('Rp 1.250.000')).toBe(1_250_000)
    expect(parseRupiahInput('')).toBeNull()
    expect(parseRupiahInput('abc')).toBeNull()
  })

  it('adds thousand separators while typing', () => {
    expect(formatAmountInput('200000')).toBe('200.000')
    expect(formatAmountInput('')).toBe('')
  })
})
