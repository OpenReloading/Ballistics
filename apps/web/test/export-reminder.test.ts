import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  afterChange,
  afterExport,
  type ExportReminder,
  parseReminder,
  reminderText,
} from '../src/lib/export-reminder.ts'

const now = new Date('2026-10-20T12:00:00.000Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
const text = (r: ExportReminder) => reminderText(r, now, english.t, english.tn)

describe('counting', () => {
  it('keeps the first change and counts every save', () => {
    const first = afterChange({ changes: 0 }, new Date(daysAgo(3)))
    const second = afterChange(first, now)
    expect(second).toEqual({ firstChangeAt: daysAgo(3), changes: 2 })
  })

  it('starts over at an export', () => {
    expect(afterExport(now)).toEqual({ exportedAt: now.toISOString(), changes: 0 })
  })
})

describe('parseReminder', () => {
  it('reads a stored state', () => {
    const stored = { exportedAt: daysAgo(2), firstChangeAt: daysAgo(1), changes: 4 }
    expect(parseReminder(JSON.stringify(stored))).toEqual(stored)
  })

  it('reads nothing stored, damaged text and wrong values as no changes', () => {
    expect(parseReminder(null).changes).toBe(0)
    expect(parseReminder('{').changes).toBe(0)
    expect(parseReminder('{"changes":-3}').changes).toBe(0)
    expect(parseReminder('{"changes":2.5}').changes).toBe(0)
    expect(parseReminder('{"changes":"9"}').changes).toBe(0)
  })

  it('drops a date that does not parse', () => {
    expect(parseReminder('{"exportedAt":"soon","firstChangeAt":7,"changes":1}')).toEqual({
      exportedAt: undefined,
      firstChangeAt: undefined,
      changes: 1,
    })
  })
})

describe('reminderText', () => {
  it('says nothing without a save, or before 10 saves and 7 days', () => {
    expect(text({ changes: 0, exportedAt: daysAgo(30) })).toBeUndefined()
    expect(text({ changes: 9, exportedAt: daysAgo(6.99) })).toBeUndefined()
    expect(text({ changes: 9 })).toBeUndefined()
  })

  it('reminds at the 10th save', () => {
    expect(text({ changes: 10, exportedAt: daysAgo(1) })).toBe('10 saves since the last export.')
    expect(text({ changes: 10, firstChangeAt: daysAgo(1) })).toBe('10 saves, never exported.')
  })

  it('reminds 7 days after the last export, else after the first save', () => {
    expect(text({ changes: 1, exportedAt: daysAgo(7) })).toBe(
      '1 save since the last export, 7 days ago.',
    )
    expect(text({ changes: 1, firstChangeAt: daysAgo(7) })).toBe('1 save, never exported.')
  })
})
