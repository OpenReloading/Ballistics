import { InputError } from '@rangefoundry/statistics'
import { describe, expect, it } from 'vitest'
import { bulletStructures, defaultStartPressure, startPressureOf } from '../src/index.ts'
import { constructionOf } from '../src/interior/start-pressure.ts'

const constructionOfStructure = (structure?: string) => constructionOf({ structure })
/** The start pressure of a 610 mm rifle barrel for a bullet structure. */
const rifleStart = (structure: string) => startPressureOf(0.61, { structure })

describe('default start pressure', () => {
  it('gives the fitted value by construction and class, the rifle assumption where none is fitted', () => {
    const rifle = defaultStartPressure(0.61)
    expect(rifle.value).toBe(30e6)
    expect(rifle.interval).toBeUndefined()
    expect(rifle.approximate).toBe(true)
    expect(defaultStartPressure(0.3).value).toBe(30e6)
    const mono = defaultStartPressure(0.61, 'monolithic')
    expect(mono.value).toBe(35.3e6)
    expect(mono.interval).toEqual([33e6, 37.9e6])
    expect(defaultStartPressure(0.61, 'jacketed').value).toBe(29.2e6)
    expect(defaultStartPressure(0.61, 'lead').interval).toEqual([24.5e6, 40.3e6])
    expect(defaultStartPressure(0.61, 'plated')).toEqual(rifle)
    const lead = defaultStartPressure(0.12, 'lead')
    expect(lead.value).toBe(24.3e6)
    expect(lead.interval).toEqual([16.7e6, 34.2e6])
    expect(defaultStartPressure(0.12, 'monolithic').value).toBe(50e6)
    expect(defaultStartPressure(0.12, 'plated').value).toBe(30.9e6)
    expect(defaultStartPressure(0.12)).toEqual(defaultStartPressure(0.12, 'jacketed'))
    expect(defaultStartPressure(0.12).value).toBe(30.8e6)
  })

  it('refuses a barrel that is not a positive number and an unknown construction', () => {
    for (const b of [Number.NaN, 0, -0.1]) expect(() => defaultStartPressure(b)).toThrow(InputError)
    for (const c of ['steel', 'constructor', 'toString'])
      expect(() => defaultStartPressure(0.12, c as never)).toThrow(InputError)
  })
})

describe('construction of a bullet record', () => {
  it('maps the structure to the construction the start pressure is fitted for', () => {
    for (const [structure, construction] of [
      ['cast', 'lead'],
      ['swaged', 'lead'],
      ['plated', 'plated'],
      ['cup-and-core', 'jacketed'],
      ['bonded', 'jacketed'],
      ['partitioned', 'jacketed'],
      ['monolithic', 'monolithic'],
    ])
      expect(constructionOfStructure(structure)).toEqual({ construction, assumed: false })
  })

  it('counts a frangible bullet and a construction without a structure as jacketed, assumed', () => {
    expect(constructionOf({ structure: 'frangible' })).toEqual({
      construction: 'jacketed',
      assumed: true,
    })
    expect(constructionOf({})).toEqual({ construction: 'jacketed', assumed: true })
    expect(constructionOf({ structure: 'constructor' })).toEqual({
      construction: 'jacketed',
      assumed: true,
    })
  })

  it('gives none for a record without a construction', () => {
    expect(constructionOf(undefined)).toBeUndefined()
  })

  it('gives each structure its construction and density class from one table', () => {
    expect(bulletStructures['swaged']).toEqual({ construction: 'lead', density: 'unknown' })
    expect(bulletStructures['cast']).toEqual({ construction: 'lead', density: 'cast' })
    expect(bulletStructures['frangible']?.construction).toBeUndefined()
  })
})

describe('start pressure of a barrel and a bullet record', () => {
  it('gives different values for two constructions below 300 mm and the same one from 300 mm', () => {
    const lead = startPressureOf(0.12, { structure: 'cast' })
    const solid = startPressureOf(0.12, { structure: 'monolithic' })
    expect([lead.value, solid.value]).toEqual([24.3e6, 50e6])
    expect(lead.interval).toEqual([16.7e6, 34.2e6])
    expect([lead.construction, solid.construction]).toEqual(['lead', 'monolithic'])
  })

  it('gives the rifle values by construction from 300 mm, not the rifle assumption', () => {
    expect([rifleStart('monolithic').value, rifleStart('cup-and-core').value]).toEqual([
      35.3e6, 29.2e6,
    ])
    expect(rifleStart('cast').interval).toEqual([24.5e6, 40.3e6])
    // the intervals of rifle monolithic and jacketed do not overlap
    expect(rifleStart('monolithic').interval?.[0]).toBeGreaterThan(
      rifleStart('cup-and-core').interval?.[1] ?? 0,
    )
    expect(rifleStart('plated').interval).toBeUndefined()
  })

  it('keeps the rifle value where the barrel is not known, and for a rifle without a construction', () => {
    const rifle = defaultStartPressure(0.3)
    expect(startPressureOf(undefined, { structure: 'cast' })).toEqual(rifle)
    expect(startPressureOf(Number.NaN, { structure: 'cast' })).toEqual(rifle)
    expect(startPressureOf(0.61, undefined)).toEqual(rifle)
  })

  it('counts a handgun without a construction as jacketed, assumed, as defaultStartPressure does', () => {
    const r = startPressureOf(0.12, undefined)
    expect(r).toEqual({ ...defaultStartPressure(0.12), construction: 'jacketed', assumed: true })
    expect(r.value).toBe(startPressureOf(0.12, {}).value)
  })

  it('marks a construction the record does not state as assumed', () => {
    const r = startPressureOf(0.12, { structure: 'frangible' })
    expect([r.value, r.construction, r.assumed]).toEqual([30.8e6, 'jacketed', true])
    expect(startPressureOf(0.12, { structure: 'cast' }).assumed).toBeUndefined()
  })
})
