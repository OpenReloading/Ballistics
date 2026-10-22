import {
  interior,
  interiorPressureRange,
  pressureToleranceDefaults,
  recordResistance,
  trajectory,
} from '@openreloading/core'
import { bulletDimensions } from '@openreloading/drawing/bullet'
import { sheetId, userRecord } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import {
  exampleChamberVolume,
  exampleFirearm,
  exampleInterior,
  exampleMuzzleVelocity,
  exampleRecords,
  exampleSeating,
  exampleTrajectory,
  interiorSources,
  loadExample,
  trajectorySources,
} from '../src/lib/example-data.ts'
import { exampleFields, quickCartridges } from '../src/lib/examples.ts'
import { siValues } from '../src/lib/field-spec.ts'
import { interiorBody, interiorFields } from '../src/lib/interior-input.ts'
import { productLabel } from '../src/lib/manufacturers.ts'
import { powderModelValues } from '../src/lib/powder-record.ts'
import {
  manualBulletFields,
  manualProjectile,
  shotFields,
  shotFromValues,
} from '../src/lib/trajectory-input.ts'
import { presetUnits, waterDensityGramsPerCm3 } from '../src/lib/units.ts'
import { readRecord } from './read-record.ts'

type Value = { side?: string; symbol: string; value: number; variant?: string }

function record(kind: string, id: string) {
  return readRecord(`${kind}/${id}.json`)
}

describe('embedded record values', () => {
  it('equal the committed records', () => {
    const b = record('bullets', exampleRecords.bullet.id)
    // the mass and the shape the seating preview reads from the record (`bulletDimensions`)
    const { id, g7: bc } = exampleRecords.bullet
    expect({ id, mass: b.mass.value, g7: bc, ...bulletDimensions(b) }).toEqual(
      exampleRecords.bullet,
    )
    const g7 = b.ballisticCoefficients.filter((c: { dragModel: string }) => c.dragModel === 'G7')
    expect(g7).toHaveLength(1)
    expect(g7[0].value).toBe(exampleRecords.bullet.g7)

    const s = record('cartridges', exampleRecords.cartridge.id)
    expect(sheetId(s)).toBe(exampleRecords.spec.id)
    const v = (side: string | undefined, symbol: string) =>
      (s.values as Value[]).find((x) => x.side === side && x.symbol === symbol && !x.variant)?.value
    expect(v('cartridge', 'G1')).toBe(exampleRecords.spec.G1)
    expect(v('cartridge', 'L3')).toBe(exampleRecords.spec.L3)
    expect(v('cartridge', 'L6')).toBe(exampleRecords.spec.L6)
    expect(v('chamber', 'F')).toBe(exampleRecords.spec.F)
    expect(v('chamber', 'Z')).toBe(exampleRecords.spec.Z)
    expect(v('chamber', 'Q')).toBe(exampleRecords.spec.Q)
    expect(v('chamber', 'u')).toBe(exampleRecords.spec.u)
    expect(v(undefined, 'Pmax')).toBe(exampleRecords.spec.Pmax)

    const p = record('powders', exampleRecords.powder.id)
    const m = record('manufacturers', p.manufacturer)
    expect(productLabel(p, new Map([[m.id, m.name]]))).toBe(exampleRecords.powder.name)
    // the model fields equal what the workbench fills from the record
    const filledFromRecord = powderModelValues(p) as Record<string, number>
    for (const [k, v] of Object.entries(filledFromRecord))
      expect(exampleInterior[k as keyof typeof exampleInterior], k).toBeCloseTo(v, 12)

    expect(record('cartridges', exampleRecords.cartridge.id).name).toBe(
      exampleRecords.cartridge.name,
    )
  })

  it('derive the chamber volume', () => {
    expect(exampleChamberVolume).toBeCloseTo(3.126, 3)
  })

  it('name each record in the sources', () => {
    const text = [...trajectorySources, ...interiorSources].join(' ')
    for (const r of Object.values(exampleRecords))
      if (r.id !== '308-win' && r.id !== exampleRecords.capacity.id) expect(text).toContain(r.id)
    expect(text).not.toContain('Example input')
    expect(text).not.toMatch(/\bsafe\b/i)
  })
})

describe('interior example', () => {
  const filled = exampleFields(interiorFields, exampleInterior, presetUnits('us'))
  const { load } = interiorBody(siValues(filled), exampleRecords.cartridge.id)
  // the bore resistance of the powder record's fit, as the workbench adds it to a run
  const spec = record('cartridges', exampleRecords.cartridge.id)
  const z = spec.values.find(
    (v: Value) => v.side === 'chamber' && v.symbol === 'Z' && !v.variant,
  )?.value
  const { resistance } = recordResistance(record('powders', exampleRecords.powder.id), {
    boreDiameter: load.chamber.boreDiameter,
    boreArea: load.chamber.boreArea,
    startPressure: load.startPressure,
    cartridge: { g1: exampleRecords.spec.G1, z },
    bulletLengthMm: exampleRecords.bullet.length,
  })
  if (resistance) load.resistance = resistance

  it('fills every field but the optional ones: Sébert factor (Lagrange), leak area, bore friction and engraving', () => {
    const optional = ['sebert', 'leakArea', 'boreFriction', 'engravingPressure', 'engravingLength']
    for (const f of interiorFields) expect(filled[f.key].text === '').toBe(optional.includes(f.key))
    expect(load).not.toHaveProperty('gradient')
    expect(load).not.toHaveProperty('leakage')
  })

  // the start load: no warning shows
  it('stays below the CIP Pmax with the upper end of its range', () => {
    expect(resistance).toBeDefined()
    const r = interior(load)
    if (!r.valid) throw new Error(`interior example invalid: ${r.reason}`)
    const range = interiorPressureRange(load, r.peakBreechPressure, pressureToleranceDefaults)
    const pmax = exampleRecords.spec.Pmax * 1e5
    expect(r.peakBreechPressure).toBeLessThan(0.8 * pmax)
    expect(range.highPressure).toBeLessThan(0.9 * pmax)
    // a load that burns out in the barrel
    expect(r.burnout).not.toBeNull()
    expect(Math.round(r.muzzleVelocity)).toBe(exampleMuzzleVelocity)
  })
})

describe('trajectory example', () => {
  it('fills every field and computes with manual G7 drag', () => {
    const filled = exampleFields(
      [...shotFields, ...manualBulletFields],
      exampleTrajectory,
      presetUnits('metric-grams'),
    )
    for (const f of [...shotFields, ...manualBulletFields]) expect(filled[f.key].text).not.toBe('')
    expect(filled.ballisticCoefficient.text).toBe('0.221')
    const si = siValues(filled)
    const t = trajectory(shotFromValues(si, manualProjectile(si, 'G7'), 'right'), [100, 1000])
    expect(t.stop).toBe('done')
    expect(Math.abs(t.points[0].height)).toBeLessThan(1e-5)
  })
})

describe('start-card cartridges', () => {
  it.each(quickCartridges)('$id has its record name and the CIP G1, F and Z of its record', (c) => {
    const r = record('cartridges', c.id)
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

describe('example rifle', () => {
  it('is a valid firearm record with the example cartridge, barrel, twist, sight height and zero', () => {
    expect(userRecord.safeParse(exampleFirearm).success).toBe(true)
    expect(exampleFirearm.data.cartridge).toBe(loadExample?.cartridge.id)
    expect(loadExample?.firearm).toBe(exampleFirearm)
    const [mount] = exampleFirearm.data.configurations[0].mounts
    expect(mount.sightHeight).toBe(exampleTrajectory.sightHeight)
    expect(mount.zeroRange).toBe(exampleTrajectory.zeroRange)
    expect(exampleFirearm.data.twist).toBe(exampleTrajectory.twist)
    expect(exampleFirearm.data.twist).toBe(exampleInterior.twist)
    expect(exampleFirearm.data.barrelLength).toBeCloseTo(exampleSeating.barrel, 9)
    expect(exampleFirearm.data.firearmMass).toBe(7)
    expect(loadExample?.firearmMass).toBe(exampleFirearm.data.firearmMass)
    // the measured case capacity (water, m³) and the seating ladder step the example fills
    expect(loadExample?.waterCapacity).toBeCloseTo(
      (exampleRecords.capacity.water / waterDensityGramsPerCm3) * 1e-6,
      15,
    )
    expect(loadExample?.seatStep).toBe(0.5e-3)
  })
})
