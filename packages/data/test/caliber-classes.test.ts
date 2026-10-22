import { caliberClasses } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { readRecords } from '../src/records.ts'

const { bundle } = readRecords()

/** Maximum projectile diameter G1, cartridge side of the CIP sheet, mm. */
const projectileDiameter = (cartridge: string) =>
  bundle.cartridges
    .find((c) => c.id === cartridge)
    ?.values.find((v) => v.symbol === 'G1' && v.side === 'cartridge')?.value

describe('caliber classes against the CIP records', () => {
  const members = caliberClasses.flatMap((c) => c.cartridges.map((id) => ({ cls: c, id })))

  it('names only cartridge records that exist', () => {
    const ids = new Set(bundle.cartridges.map((c) => c.id))
    expect(members.filter(({ id }) => !ids.has(id)).map(({ id }) => id)).toEqual([])
  })

  it('keeps the nominal diameter of a class within 0.15 mm of G1 of each member', () => {
    const off = members
      .map(({ cls, id }) => ({
        class: cls.id,
        id,
        g1: projectileDiameter(id),
        nominal: cls.diameter,
      }))
      .filter((m) => m.g1 === undefined || Math.abs(m.g1 - m.nominal) > 0.15)
    expect(off).toEqual([])
  })
})
