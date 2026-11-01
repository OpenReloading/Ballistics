import { bulletStructures } from '@open-reloading/core'
import { constructionFields } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { followWrites } from '../src/components/use-workbench-load.ts'
import { english } from '../src/i18n/translate.ts'
import type { Suggestions } from '../src/lib/input-defaults.ts'
import { startPressureDefault } from '../src/lib/start-pressure.ts'
import { presetUnits } from '../src/lib/units.ts'
import { citedDefaults } from '../src/lib/workbench-defaults.ts'

const cited = citedDefaults.startPressure.si
const show = { text: (si: number) => (si / 1e6).toFixed(1), unit: 'MPa' }
const pistol = 0.1016
const rifle = 0.6096

const of = (barrel: number | undefined, structure?: string, current = cited) =>
  startPressureDefault({
    barrel,
    construction: structure === undefined ? undefined : { structure },
    current,
    show,
    t: english.t,
  })

it('gives two bullets of different construction different default start pressures', () => {
  const lead = startPressureDefault({
    barrel: pistol,
    construction: { structure: 'cast' },
    current: cited,
    show,
    t: english.t,
  })
  const solid = of(pistol, 'monolithic')
  expect([lead.si, solid.si]).toEqual([24.3e6, 50e6])
  expect(lead.approximate).toBe(true)
})

it('names the construction and the 95 % interval in the source', () => {
  expect(of(pistol, 'cast').source).toBe(
    'handgun load tables, bullet construction lead, barrel under 300 mm; approximate, 95 % interval 16.7 to 34.2 MPa',
  )
  expect(of(pistol, 'frangible').source).toContain('jacketed, assumed')
})

it('gives a rifle barrel the rifle value of the construction, with the class in the source', () => {
  const solid = of(rifle, 'monolithic')
  expect(solid.si).toBe(35.3e6)
  expect(solid.source).toBe(
    'rifle load tables, bullet construction monolithic, barrel 300 mm or longer; approximate, 95 % interval 33.0 to 37.9 MPa',
  )
  expect(of(rifle, 'cup-and-core').si).toBe(29.2e6)
})

it('counts a handgun bullet without a construction as jacketed, assumed', () => {
  const s = of(pistol)
  expect(s.si).toBe(30.8e6)
  expect(s.source).toContain('jacketed, assumed')
})

it('keeps the value of before where the construction of a rifle bullet or the barrel is not known', () => {
  for (const s of [of(rifle), of(rifle, 'plated'), of(undefined, 'cast')]) {
    expect(s.si).toBe(cited)
    expect(s.approximate).toBeUndefined()
    expect(s.source).toBe('approximate model default for barrels of 300 mm and longer')
  }
})

it("keeps the user's own default of Settings", () => {
  const own = of(pistol, 'cast', 28e6)
  expect(own.si).toBe(28e6)
  expect(own.source).toBe('your default from Settings')
})

/** What the follow effect writes for a start pressure that follows the default of a bullet. */
const written = (followed: boolean, now: number, suggestion: number) => {
  const suggestions: Suggestions = { startPressure: { si: suggestion, source: '' } }
  return followWrites({
    followed: new Set(followed ? ['startPressure' as const] : []),
    seatedVolume: false,
    now: { startPressure: { text: '', si: now } },
    suggestions,
    written: {},
    system: presetUnits('metric-grams'),
  }).map(([k, v]) => [k, v.si])
}

it('writes the default of a new bullet over the one before, and never over a typed value', () => {
  expect(written(true, cited, 24.3e6)).toEqual([['startPressure', 24.3e6]])
  expect(written(false, 31e6, 24.3e6)).toEqual([])
})

it('maps every structure of the bullet schema in the one table of core', () => {
  const structures = constructionFields.shape.structure.unwrap().options
  expect(structures.filter((s) => !Object.hasOwn(bulletStructures, s))).toEqual([])
  expect(Object.keys(bulletStructures).sort()).toEqual([...structures].sort())
})
