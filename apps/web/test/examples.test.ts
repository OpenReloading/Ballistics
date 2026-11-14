import { describe, expect, it } from 'vitest'
import { quickCartridges } from '../src/lib/examples.ts'
import { readRecord } from './read-record.ts'

type Value = {
  side?: string | undefined
  symbol: string
  value: number
}

describe('start-card cartridges', () => {
  it.each(quickCartridges)('$id has its record name and the CIP G1, F and Z of its record', (c) => {
    const r = readRecord(`cartridges/${c.id}.json`)
    expect(r.name).toBe(c.name)
    const least = (side: string, symbol: string) =>
      Math.min(
        ...(r.values as Value[])
          .filter((v) => v.side === side && v.symbol === symbol)
          .map((v) => v.value),
      )
    expect([least('cartridge', 'G1'), least('chamber', 'F'), least('chamber', 'Z')]).toEqual([
      c.g1,
      c.land,
      c.groove,
    ])
  })
})
