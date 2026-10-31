import { bulletDimensions, bulletOutline } from '@open-reloading/drawing/bullet'
import { chamberOf } from '@open-reloading/drawing/seating'
import type { Bullet } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  type BelowMouth,
  belowMouth,
  lessBullet,
  unseatedBecause,
} from '../src/lib/bullet-below-mouth.ts'
import { classOf, effectiveDensity } from '../src/lib/bullet-construction.ts'
import { designShape } from '../src/lib/bullet-designer.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

/** A name-only record: the mass of a published load table, no diameter, no length. */
const nameOnly: Bullet = {
  id: 'example-a-nameonly',
  manufacturer: 'example-a',
  name: 'Test 168',
  nameOnly: true,
  mass: { value: 10.886 },
  provenance: { kind: 'published', sources: [{ title: 'Test load table' }] },
}

/** Case length L3 and maximum overall length L6 of a made-up rifle cartridge, mm. */
const chamber = { caseLength: 51.18, cartridgeL6: 71.12 }
const groove = 7.823
const capacity = 3.63e-6 / 0.9982
const show = { text: (si: number) => (si * 1e6).toFixed(2), unit: 'cm³' }

const estimate = (record: Partial<Bullet>, because: Parameters<typeof belowMouth>[0]['because']) =>
  belowMouth({ record, shape: undefined, groove, chamber, coal: undefined, because })

it('estimates the volume below the mouth of a name-only bullet from its mass and the groove diameter', () => {
  const e = estimate(nameOnly, 'dimensions')
  if (e.kind !== 'estimate') throw new Error('estimate expected')
  expect(e.volume).toBeGreaterThan(0)
  expect(e.low).toBeLessThan(e.volume)
  expect(e.high).toBeGreaterThan(e.volume)
  // below the case volume, which the bullet cannot fill
  expect(e.high).toBeLessThan(capacity)
})

it('takes the diameter of the record before the groove diameter', () => {
  const wide = estimate({ ...nameOnly, diameter: { value: 9 } }, 'dimensions')
  const narrow = estimate({ ...nameOnly, diameter: { value: 6 } }, 'dimensions')
  if (wide.kind !== 'estimate' || narrow.kind !== 'estimate') throw new Error('estimate expected')
  expect(wide.volume).not.toBe(narrow.volume)
})

it('refuses and names what is missing', () => {
  const missing = (r: BelowMouth) => (r.kind === 'refused' ? r.missing : [])
  const base = {
    record: nameOnly,
    shape: undefined,
    groove,
    chamber,
    coal: undefined,
    because: 'dimensions',
  } as const
  expect(missing(belowMouth({ ...base, groove: undefined }))).toEqual(['bullet diameter'])
  expect(missing(belowMouth({ ...base, chamber: undefined }))).toEqual(['case length L3'])
  expect(missing(belowMouth({ ...base, chamber: { caseLength: 51.18 } }))).toEqual([
    'overall length COAL or L6',
  ])
  expect(
    missing(
      belowMouth({
        ...base,
        record: {
          id: nameOnly.id,
          manufacturer: nameOnly.manufacturer,
          name: nameOnly.name,
          provenance: nameOnly.provenance,
        },
        groove: undefined,
      }),
    ),
  ).toEqual(['bullet diameter', 'bullet mass'])
})

it('classes a record by its construction fields and pools the rest', () => {
  const of = (structure?: string) =>
    classOf(structure === undefined ? undefined : ({ structure } as never))
  expect(['cast', 'monolithic', 'cup-and-core', 'bonded', 'partitioned'].map(of)).toEqual([
    'cast',
    'monolithic',
    'jacketed',
    'jacketed',
    'jacketed',
  ])
  expect(['swaged', 'plated', 'frangible', 'constructor', undefined].map(of)).toEqual(
    Array(5).fill('unknown'),
  )
  expect(Object.values(effectiveDensity).map((d) => d.value)).toEqual([9.1, 6.5, 7.3, 6.8])
})

it('takes a shorter bullet for a denser class and the widest interval for the pooled class', () => {
  // the same mass and diameter: a denser class is shorter, so it takes less of the case
  const at = (structure: 'cast' | 'monolithic' | undefined) =>
    estimate(
      { ...nameOnly, ...(structure && { construction: { raw: 'x', structure } }) },
      'seating',
    )
  const [cast, mono, pooled] = [at('cast'), at('monolithic'), at(undefined)]
  if (cast.kind !== 'estimate' || mono.kind !== 'estimate' || pooled.kind !== 'estimate')
    throw new Error('estimate expected')
  expect(cast.volume).toBeLessThan(mono.volume)
  expect([cast.from, mono.from, pooled.from]).toEqual(['cast', 'monolithic', 'unknown'])
  // the pooled class has the widest interval, a cast bullet the narrowest
  const width = (e: typeof cast) => e.high - e.low
  expect(width(cast)).toBeLessThan(width(pooled))
  expect(width(mono)).toBeLessThan(width(pooled))
})

it('subtracts the estimate from the capacity as an approximate default with its interval', () => {
  const unseated = estimate(nameOnly, 'dimensions')
  const given = defined(
    lessBullet(
      { si: capacity, source: 'case capacity record of X, without the bullet' },
      unseated,
      show,
      english.t,
    ),
  )
  if (unseated.kind !== 'estimate') throw new Error('estimate expected')
  expect(given.si).toBeCloseTo(capacity - unseated.volume, 12)
  expect(given.si).toBeLessThan(capacity)
  expect(given.approximate).toBe(true)
  // the run's tolerance of the volume: the wider side of the interval, relative
  expect(given.halfWidth).toBeCloseTo(
    Math.max(given.si - (capacity - unseated.high), capacity - unseated.low - given.si) / given.si,
    12,
  )
  expect(given.source).toContain('case capacity record of X, without the bullet')
  expect(given.source).toContain(show.text(capacity - unseated.high))
  expect(given.source).toContain(show.text(capacity - unseated.low))
  expect(given.source).toMatch(
    /approximate, interval .*\. Length from diameter and mass with the effective density of the class construction unknown, seated at L6 of the cartridge, because the bullet has no length or diameter\./,
  )
})

it('seats a name-only bullet at the COAL entered, shorter than at L6, and says so', () => {
  const at = (coal: number | undefined) =>
    belowMouth({ record: nameOnly, shape: undefined, groove, chamber, coal, because: 'seating' })
  const [entered, l6] = [at(60), at(undefined)]
  if (entered.kind !== 'estimate' || l6.kind !== 'estimate') throw new Error('estimate expected')
  expect([entered.coal, l6.coal]).toEqual(['entered', 'L6'])
  // a shorter COAL puts more of the bullet into the case
  expect(entered.volume).toBeGreaterThan(l6.volume)
  const given = defined(lessBullet({ si: capacity, source: 'capacity' }, entered, show, english.t))
  expect(given.source).toContain('seated at the COAL entered, because no seating length is entered')
})

it('takes the volume of a record with a length from its outline, not from its mass', () => {
  const shape = defined(
    bulletDimensions({
      ...nameOnly,
      diameter: { value: 7.823 },
      length: { value: 31 },
      provenance: nameOnly.provenance,
    }),
  )
  const e = belowMouth({
    record: nameOnly,
    shape,
    groove,
    chamber,
    coal: 60,
    because: 'seating',
  })
  if (e.kind !== 'estimate') throw new Error('estimate expected')
  expect(e.from).toBe('length')
  expect(e.volume).toBeGreaterThan(0)
  expect(e.volume).toBeLessThan(capacity)
})

it('gives no default when the bullet volume is refused, and leaves a seated bullet alone', () => {
  const refused = belowMouth({
    record: nameOnly,
    shape: undefined,
    groove: undefined,
    chamber,
    coal: undefined,
    because: 'dimensions',
  })
  const capacityOnly = { si: capacity, source: 'capacity' }
  expect(lessBullet(capacityOnly, refused, show, english.t)).toBeUndefined()
  expect(lessBullet(capacityOnly, undefined, show, english.t)).toBe(capacityOnly)
  expect(lessBullet(undefined, estimate(nameOnly, 'seating'), show, english.t)).toBeUndefined()
})

/** The listed paths on which no seated outline is built, each from the condition the preview reads. */
const paths = {
  'the record has no length': () =>
    unseatedBecause({
      shaped: bulletDimensions({ ...nameOnly, diameter: { value: 7.823 } }) !== undefined,
      refused: false,
      chamber: true,
      cbto: false,
    }),
  'the outline is refused': () => {
    const shape = defined(
      bulletDimensions({
        ...nameOnly,
        diameter: { value: 7.823 },
        length: { value: 31 },
        ogive: { form: 'no-such-form' },
        provenance: nameOnly.provenance,
      }),
    )
    return unseatedBecause({
      shaped: true,
      refused: 'reason' in bulletOutline(shape),
      chamber: true,
      cbto: false,
    })
  },
  'the cartridge has no chamber values': () =>
    unseatedBecause({
      shaped: true,
      refused: false,
      chamber: chamberOf([]) !== undefined,
      cbto: false,
    }),
  'CBTO is chosen for a bullet without base-to-ogive': () => {
    const shape = defined(
      bulletDimensions({
        ...nameOnly,
        diameter: { value: 7.823 },
        length: { value: 31 },
        provenance: nameOnly.provenance,
      }),
    )
    return unseatedBecause({
      shaped: true,
      refused: false,
      chamber: true,
      cbto: shape.baseToOgive === undefined,
    })
  },
  'a user design has no length': () =>
    unseatedBecause({
      shaped:
        designShape(
          { base: { status: 'none' }, record: { ...nameOnly, diameter: { value: 7.823 } } },
          presetUnits('metric-grams'),
        ) !== undefined,
      refused: false,
      chamber: true,
      cbto: false,
    }),
  'the seat position is empty': () =>
    unseatedBecause({ shaped: true, refused: false, chamber: true, cbto: false }),
} as const

it.each(Object.entries(paths))('never leaves the case capacity whole when %s', (name, because) => {
  const why = because()
  expect(why).toBe(
    {
      'the record has no length': 'dimensions',
      'the outline is refused': 'outline',
      'the cartridge has no chamber values': 'chamber',
      'CBTO is chosen for a bullet without base-to-ogive': 'cbto',
      'a user design has no length': 'dimensions',
      'the seat position is empty': 'seating',
    }[name],
  )
  const given = lessBullet(
    { si: capacity, source: 'capacity' },
    // the chamber of the cartridge is known except on its own path
    belowMouth({
      record: nameOnly,
      shape: undefined,
      groove,
      chamber: why === 'chamber' ? undefined : chamber,
      coal: undefined,
      because: why,
    }),
    show,
    english.t,
  )
  expect(given === undefined || given.si < capacity).toBe(true)
})
