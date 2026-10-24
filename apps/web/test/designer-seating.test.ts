import type { BulletDimensions } from '@openreloading/drawing/seating'
import { chamberOf, jumpNote, seat } from '@openreloading/drawing/seating'
import { describe, expect, it } from 'vitest'
import {
  type Action,
  draftSpec,
  fieldSpecs,
  fromRecord,
  type History,
  historyOf,
  reduce,
} from '../src/lib/cartridge-designer.ts'
import { exampleRecords } from '../src/lib/example-data.ts'
import { fieldValueFromText } from '../src/lib/field-spec.ts'
import { presetUnits, waterDensityGramsPerCm3 } from '../src/lib/units.ts'
import { sheetRecord } from './records.ts'

const metric = presetUnits('metric-grams')
const win308 = () => fromRecord(sheetRecord('cip-308-win-2008-09-23'), metric)

const { bullet: example } = exampleRecords
const bullet: BulletDimensions = {
  diameter: example.diameter,
  length: example.length,
  noseLength: example.noseLength,
  baseToOgive: example.baseToOgive,
  bearingLength: example.bearingLength,
  meplatDiameter: example.meplatDiameter,
  base: example.base,
  ogive: example.ogive,
}

/** The design after `actions`, as the seating reads it: its values in mm and degrees. */
function designValues(...actions: Action[]) {
  const h = actions.reduce<History>(reduce, historyOf(win308()))
  return draftSpec(h.present).values
}
const type = (key: string, text: string): Action => {
  const q = fieldSpecs.find((s) => s.key === key)?.quantity ?? 'length'
  return { type: 'field', key, value: fieldValueFromText(q, metric, text) }
}
const clear = (key: string): Action => type(key, '')

const seatIn = (
  values: ReturnType<typeof designValues>,
  coal: number,
  more: Partial<Parameters<typeof seat>[0]> = {},
) => {
  const chamber = chamberOf(values)
  if (!chamber) throw new Error('no cartridge L3')
  return seat({
    bullet,
    chamber,
    waterDensity: waterDensityGramsPerCm3,
    by: { kind: 'overallLength', value: coal },
    ...more,
  })
}

describe('seating from design values', () => {
  it('reads the case length and the chamber from the design, not from a record', () => {
    const chamber = chamberOf(designValues(type('cartridge.L3', '50'), type('chamber.G1', '7.9')))
    expect(chamber).toMatchObject({ caseLength: 50, G1: 7.9 })
  })

  it('has no chamber without a cartridge L3', () => {
    expect(chamberOf(designValues(clear('cartridge.L3')))).toBeUndefined()
  })

  it('follows the design: a longer case seats the same COAL deeper', () => {
    const at = (L3: string) => seatIn(designValues(type('cartridge.L3', L3)), 71).depth.value
    expect(at('51.18')).toBeCloseTo(51.18 - (71 - example.length), 9)
    expect(at('52.18') - at('51.18')).toBeCloseTo(1, 9)
  })

  it('gives no volume without a capacity and a volume that follows the seating depth with one', () => {
    const values = designValues()
    expect(seatIn(values, 71).volumeBehindBullet).toBeUndefined()
    const water = { waterCapacity: 56 }
    const deep = seatIn(values, 68, water)
    const shallow = seatIn(values, 71, water)
    expect(shallow.caseVolume?.value).toBeCloseTo(56 / waterDensityGramsPerCm3, 9)
    // seated deeper, the bullet takes more of the case
    expect(deep.volumeBehindBullet?.value).toBeLessThan(shallow.volumeBehindBullet?.value as number)
  })

  it('gives no travel without a barrel length', () => {
    expect(seatIn(designValues(), 71).travel).toBeUndefined()
    expect(seatIn(designValues(), 71, { barrelLength: 610 }).travel?.value).toBeCloseTo(
      610 - (71 - example.length),
      9,
    )
  })

  it('names what a design lacks for the jump and gives none', () => {
    const lacking = seatIn(designValues(clear('chamber.s'), clear('chamber.G')), 71)
    expect(lacking.jump.value).toBeUndefined()
    expect(jumpNote(lacking.jump)).toContain('chamber s or G')
    expect(seatIn(designValues(), 71).jump.value).toBeDefined()
  })

  it('tags the volume of a hollow-base design approximate', () => {
    const hollow = seatIn(designValues(), 68, {
      bullet: {
        ...bullet,
        base: { ...bullet.base, type: 'conical-hollow-base', cavityDiameter: 4 },
      },
      waterCapacity: 56,
    })
    expect(hollow.volumeBehindBullet?.tag).toBe('approximate')
  })
})
