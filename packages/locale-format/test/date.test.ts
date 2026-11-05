import { describe, expect, it } from 'vitest'
import { dateTimeText, dayText, monthText, timeText } from '../src/index.ts'

/** `run` with the time zone `tz`, the one before it restored. */
function inZone(tz: string, run: () => void) {
  const before = process.env['TZ']
  process.env['TZ'] = tz
  try {
    run()
  } finally {
    if (before === undefined) delete process.env['TZ']
    else process.env['TZ'] = before
  }
}

describe('days', () => {
  it('writes a day as day, month name and year, the same in every time zone', () => {
    inZone('America/Los_Angeles', () => {
      expect(dayText('2026-05-01', 'en')).toBe('1 May 2026')
      expect(dayText('2025-12-31', 'en')).toBe('31 December 2025')
      expect(dayText('2026-05-01', 'de')).toBe('1. Mai 2026')
    })
    expect(dayText('2026-05-01', 'en')).toBe('1 May 2026')
  })

  it('keeps text that is no day as given', () => {
    expect(dayText('2026-13-40', 'en')).toBe('2026-13-40')
    expect(dayText('May 2026', 'de')).toBe('May 2026')
  })

  it('names a month in the language', () => {
    expect(monthText(0, 'en')).toBe('January')
    expect(monthText(11, 'de')).toBe('Dezember')
  })
})

describe('times', () => {
  const d = new Date(Date.UTC(2026, 4, 1, 13, 5, 9))

  it('writes a time of day in 24 hours, English too', () => {
    inZone('UTC', () => {
      expect(timeText(d, 'en')).toBe('13:05:09')
      expect(timeText(d, 'de')).toBe('13:05:09')
    })
  })

  it('writes a date and time in the language, English in the default locale', () => {
    inZone('UTC', () => {
      expect(dateTimeText(d, 'de')).toBe('1.5.2026, 13:05:09')
      expect(dateTimeText(d, 'en')).toBe(d.toLocaleString())
    })
  })
})
