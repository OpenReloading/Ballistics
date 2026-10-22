import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { localDay } from '../src/lib/dates.ts'

describe('local day', () => {
  it('is the local day, not the UTC day', () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/New_York'
    try {
      // 22:00 on 16 October in New York
      expect(localDay(new Date('2026-10-17T02:00:00Z'))).toBe('2026-10-16')
      expect(localDay(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05')
    } finally {
      if (tz === undefined) delete process.env.TZ
      else process.env.TZ = tz
    }
  })

  it('is the day of every print and file name: no source takes the UTC day', () => {
    const src = new URL('../src/', import.meta.url)
    const utcDay = /toISOString\(\)\s*\.slice\(0,\s*10\)/
    const hits = readdirSync(src, { recursive: true, encoding: 'utf8' })
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => utcDay.test(readFileSync(new URL(f, src), 'utf8')))
    expect(hits).toEqual([])
  })
})
