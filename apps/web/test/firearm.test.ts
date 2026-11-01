import type { CompetitionEvent, UserRecord } from '@open-reloading/schema'
import { toSi, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { type Catalogue, translator } from '../src/i18n/translate.ts'
import { loadExample } from '../src/lib/example-data.ts'
import {
  activeClick,
  blankFirearm,
  cardFacts,
  catalogueCartridgeId,
  clickOptions,
  clickText,
  eventRounds,
  eventRoundsDue,
  fieldSi,
  fieldStored,
  firearmCells,
  firearmPatch,
  firearmProblem,
  freeId,
  gunPicker,
  gunValues,
  landsFor,
  landsOf,
  roundsDue,
  sightOptions,
  sightPicker,
  withEventRounds,
  withSessionRounds,
} from '../src/lib/firearm.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined, missing } from './defined.ts'

const saved = '2026-10-13T10:00:00.000Z'
const rifle: UserRecord = {
  kind: 'firearm',
  id: 'r1',
  name: 'Range rifle',
  saved,
  data: {
    origin: 'user',
    name: 'Range rifle',
    twist: { value: 254 },
    twistHand: 'left',
    optics: [
      { id: 'o1', kind: 'scope', name: 'Scope' },
      { id: 'o2', kind: 'redDot', name: 'Dot' },
    ],
    configurations: [
      {
        id: 'c1',
        name: 'Winter',
        mounts: [{ optic: 'o1', sightHeight: { value: 50 }, zeroRange: { value: 200000 } }],
      },
      {
        id: 'c2',
        name: 'Summer',
        mounts: [
          { optic: 'o1', sightHeight: { value: 55 }, zeroRange: { value: 100000 } },
          { optic: 'o2', sightHeight: { value: 40 }, zeroRange: { value: 50000 } },
        ],
      },
    ],
    active: 'c2',
  },
}
const carbine: UserRecord = {
  kind: 'firearm',
  id: 'r2',
  name: 'Carbine',
  saved,
  data: {
    origin: 'user',
    name: 'Carbine',
    twistHand: 'right',
    optics: [{ id: 'o1', kind: 'ironSights', name: 'Irons' }],
    configurations: [
      {
        id: 'c1',
        name: 'Irons',
        mounts: [{ optic: 'o1', sightHeight: { value: 70 }, zeroRange: { value: 25000 } }],
      },
    ],
  },
}

describe('sightOptions', () => {
  const options = sightOptions([
    rifle,
    carbine,
    { ...carbine, kind: 'load', data: { origin: 'user' } } as UserRecord,
  ])

  it('lists every mount of every configuration, the active configuration of a firearm first', () => {
    expect(options.map((o) => o.label)).toEqual([
      'Range rifle, Summer, Scope (active)',
      'Range rifle, Summer, Dot (active)',
      'Range rifle, Winter, Scope',
      'Carbine, Irons, Irons',
    ])
    expect(new Set(options.map((o) => o.value)).size).toBe(4)
  })

  it('fills sight height and zero range of the mount and the twist of the firearm, in SI', () => {
    expect(defined(options[1]).fill).toEqual({
      sightHeight: 0.04,
      zeroRange: 50,
      twist: 0.254,
      twistHand: 'left',
    })
    expect(defined(options[3]).fill).toEqual({
      sightHeight: 0.07,
      zeroRange: 25,
      twistHand: 'right',
    })
  })

  it('fills the zero air and the drag factor with its source of a mount that has them', () => {
    const stored = {
      zeroTemperature: { value: 30 },
      zeroPressure: { value: 0.98 },
      zeroHumidity: { value: 40 },
      dragFactor: 1.034,
      dragFactorSource: 'Truing session of 2026-09-14',
    }
    const zeroed = {
      zeroTemperature: toSi('temperature', 30),
      zeroPressure: toSi('pressure', 0.98),
      zeroHumidity: toSi('relativeHumidity', 40),
      dragFactor: 1.034,
      dragFactorSource: 'Truing session of 2026-09-14',
    }
    expect(zeroed.zeroTemperature).toBeCloseTo(303.15, 9)
    expect(zeroed.zeroPressure).toBeCloseTo(98000, 6)
    expect(zeroed.zeroHumidity).toBeCloseTo(0.4, 12)
    const data = (rifle as Extract<UserRecord, { kind: 'firearm' }>).data
    const [scope, dot] = defined(data.configurations[1]).mounts
    const withZero = {
      ...rifle,
      data: {
        ...data,
        configurations: [
          data.configurations[0],
          { ...data.configurations[1], mounts: [{ ...scope, ...stored }, dot] },
        ],
      },
    } as UserRecord
    const [first = missing(), second = missing()] = sightOptions([withZero])
    expect(first.fill).toMatchObject({ sightHeight: 0.055, ...zeroed })
    // a mount without them leaves the keys out, so a choice empties the fields
    for (const key of Object.keys(zeroed)) expect(second.fill).not.toHaveProperty(key)
  })

  it('does not fill a twist of 0', () => {
    const flat = { ...rifle, data: { ...rifle.data, twist: { value: 0 } } } as UserRecord
    expect(defined(sightOptions([flat])[0]).fill).not.toHaveProperty('twist')
  })
})

describe('firearm helpers', () => {
  it('a blank firearm is a valid record once named', () => {
    const r = { kind: 'firearm', id: 'x', name: 'New', saved, data: blankFirearm() }
    expect(userRecord.safeParse(r).success).toBe(true)
    expect(defined(userRecord.safeParse({ ...r, name: '' }).error?.issues[0]).path).toEqual([
      'name',
    ])
  })

  it('names the field and its place when a firearm is not valid, never a path', () => {
    const data = (rifle as Extract<UserRecord, { kind: 'firearm' }>).data
    const [winter, summer = missing()] = data.configurations
    const dot = summer.mounts[1]
    expect(firearmProblem('Range rifle', data)).toBeUndefined()
    expect(firearmProblem('', data)).toBe('Enter a name.')
    const problem = (p: object) => firearmProblem('Range rifle', { ...data, ...p })
    expect(
      problem({
        configurations: [
          winter,
          { ...summer, mounts: [summer.mounts[0], { ...dot, zeroRange: { value: 0 } }] },
        ],
      }),
    ).toBe('Zero range in configuration Summer, mount 2: must be greater than 0.')
    expect(
      problem({
        configurations: [winter, { ...summer, mounts: [summer.mounts[0], { optic: 'o2' }] }],
      }),
    ).toBe('Sight height above the bore in configuration Summer, mount 2: enter a number.')
    const zeroed = (m: object) => ({
      configurations: [winter, { ...summer, mounts: [{ ...summer.mounts[0], ...m }, dot] }],
    })
    expect(problem(zeroed({ dragFactor: 0 }))).toBe(
      'Drag factor in configuration Summer, mount 1: must be greater than 0.',
    )
    expect(problem(zeroed({ zeroHumidity: { value: 120 } }))).toBe(
      'Zero humidity in configuration Summer, mount 1: must be from 0 to 100 %.',
    )
    expect(problem({ roundCount: 1.5 })).toBe('Round count: must be a whole number.')
    expect(problem({ noteAtRoundCount: 0 })).toBe('Note at round count: must be greater than 0.')
    expect(problem({ noteAtRoundCount: 500 })).toBeUndefined()
    expect(problem({ firearmMass: { value: 0 } })).toBe('Mass: must be greater than 0.')
    expect(
      problem({
        optics: [{ ...data.optics[0], minMagnification: 25, maxMagnification: 5 }, data.optics[1]],
      }),
    ).toBe('Magnification, highest in optic Scope: below the lowest magnification.')
    expect(
      problem({
        configurations: [{ ...winter, mounted: '2026-05-01', removed: '2026-04-30' }, summer],
      }),
    ).toBe('Removed on in configuration Winter: before the mount date.')
  })

  it('finds a free local id', () => {
    expect(freeId('o', ['o1', 'o2', 'o4'])).toBe('o3')
  })
})

describe('stored units at the form edge', () => {
  it('converts a stored field to SI and back, a plain number as it is', () => {
    const barrel = { quantity: 'barrelLength' } as const
    expect(fieldSi(barrel, { value: 610 })).toBe(0.61)
    expect(fieldStored(barrel, 0.61)).toEqual({ value: 610 })
    // no noise from the round trip in what is saved
    expect(fieldStored(barrel, 0.055)).toEqual({ value: 55 })
    const humidity = { quantity: 'percent' } as const
    expect(fieldSi(humidity, { value: 40 })).toBeCloseTo(0.4, 12)
    expect(fieldStored(humidity, 0.4)).toEqual({ value: expect.closeTo(40, 9) })
    const factor = { quantity: 'dragFactor' } as const
    expect(fieldSi(factor, 1.034)).toBe(1.034)
    expect(fieldStored(factor, 1.034)).toBe(1.034)
    expect(fieldSi(barrel, undefined)).toBeUndefined()
    expect(fieldStored(barrel, undefined)).toBeUndefined()
  })

  it('gives the Gun card twist, barrel length and mass in SI', () => {
    const data = (rifle as Extract<UserRecord, { kind: 'firearm' }>).data
    expect(
      gunValues({ ...data, barrelLength: { value: 610 }, firearmMass: { value: 4200 } }),
    ).toEqual({ twist: 0.254, barrelLength: 0.61, firearmMass: 4.2 })
    expect(gunValues(blankFirearm())).toEqual({
      lands: undefined,
      twist: undefined,
      barrelLength: undefined,
      firearmMass: undefined,
    })
  })

  it('gives the lands contact in SI only with a length and the bullet it was measured with', () => {
    const data = (rifle as Extract<UserRecord, { kind: 'firearm' }>).data
    const bullet = 'catalogue:test-bullet'
    expect(landsOf(data)).toBeUndefined()
    expect(landsOf({ ...data, baseToOgiveAtLands: { value: 28.4 } })).toBeUndefined()
    expect(landsOf({ ...data, landsBullet: bullet })).toBeUndefined()
    const both = { ...data, landsBullet: bullet, overallLengthAtLands: { value: 71.2 } }
    expect(landsOf(both)).toEqual({ bullet, baseToOgive: undefined, overallLength: 0.0712 })
    expect(gunValues(both).lands).toEqual(landsOf(both))
  })

  it('uses a lands contact only for the bullet it was measured with', () => {
    const lands = { bullet: 'catalogue:a', baseToOgive: 0.0284 }
    expect(landsFor(lands, 'catalogue:a')).toEqual({ contact: lands, other: false })
    expect(landsFor(lands, 'catalogue:b')).toEqual({ contact: undefined, other: true })
    expect(landsFor(lands, undefined)).toEqual({ contact: undefined, other: true })
    expect(landsFor(undefined, 'catalogue:a')).toEqual({ contact: undefined, other: false })
  })

  it('names the catalogue record of a cartridge reference only', () => {
    expect(catalogueCartridgeId('catalogue:308-win')).toBe('308-win')
    expect(catalogueCartridgeId('user:3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13')).toBeUndefined()
    expect(catalogueCartridgeId(undefined)).toBeUndefined()
  })
})

describe('clickOptions', () => {
  it('lists mounted optics with a click value, the active configuration first', () => {
    const scoped = {
      ...rifle,
      data: {
        ...rifle.data,
        optics: [
          {
            id: 'o1',
            kind: 'scope',
            name: 'Scope',
            clickUnit: 'mrad',
            clickValue: { value: 0.00573 },
          },
          { id: 'o2', kind: 'redDot', name: 'Dot' },
        ],
      },
    } as UserRecord
    expect(clickOptions([scoped, carbine])).toEqual([
      {
        value: 'r1/c2/0',
        label: 'Range rifle, Summer, Scope (active)',
        click: toSi('angle', 0.00573),
        unit: 'mrad',
      },
      {
        value: 'r1/c1/0',
        label: 'Range rifle, Winter, Scope',
        click: toSi('angle', 0.00573),
        unit: 'mrad',
      },
    ])
  })
})

describe('activeClick', () => {
  it('takes the active configuration only', () => {
    const scoped = (click: { value: number } | undefined) =>
      ({
        ...rifle,
        data: {
          ...rifle.data,
          optics: [
            { id: 'o1', kind: 'scope', name: 'Scope', clickValue: click },
            { id: 'o2', kind: 'redDot', name: 'Dot' },
          ],
          configurations: [
            rifle.data.configurations[0],
            {
              id: 'c2',
              name: 'Summer',
              mounts: [{ optic: 'o2', sightHeight: { value: 40 }, zeroRange: { value: 50000 } }],
            },
          ],
        },
      }) as UserRecord
    // the active Summer configuration mounts only the dot, which has no click value
    expect(activeClick(scoped({ value: 0.00573 }))).toBeUndefined()
    expect(activeClick(carbine)).toBeUndefined()
    // without an active configuration the first one counts: Winter mounts the scope
    const first = scoped({ value: 0.00573 }) as Extract<UserRecord, { kind: 'firearm' }>
    expect(activeClick({ ...first, data: { ...first.data, active: undefined } })?.click).toBe(
      toSi('angle', 0.00573),
    )
    expect(
      activeClick({ ...rifle, data: { ...rifle.data, active: undefined } } as UserRecord),
    ).toBeUndefined()
  })
})

describe('cardFacts and clickText', () => {
  const metric = presetUnits('metric-grams')
  const us = presetUnits('us')
  const f = rifle.kind === 'firearm' ? rifle.data : blankFirearm()
  const english = translator().t
  it('names barrel, twist and the first optic of the active configuration with its zero', () => {
    expect(cardFacts({ ...f, barrelLength: { value: 610 } }, metric, english)).toEqual({
      barrel: '610 mm barrel, 1:254 mm, left',
      sight: 'Scope, zero 100 m',
    })
    expect(cardFacts(f, us, english).barrel).toBe('1:10.0 in, left')
    expect(
      cardFacts({ ...f, barrelLength: { value: 609.6 } }, presetUnits('metric-grains'), english)
        .barrel,
    ).toBe('24.00 in barrel, 1:10.0 in, left')
    // no active configuration: the first one; nothing entered: nothing shown
    expect(cardFacts({ ...f, active: undefined }, metric, english).sight).toBe('Scope, zero 200 m')
    expect(cardFacts(blankFirearm(), metric, english)).toEqual({
      barrel: undefined,
      sight: undefined,
    })
  })
  it('gives the table cells without units, those of the active configuration', () => {
    expect(firearmCells({ ...f, barrelLength: { value: 610 } }, metric, english)).toEqual({
      barrel: '610',
      twist: '254',
      hand: 'left',
      optic: 'Scope',
      zero: '100',
      configuration: 'Summer',
    })
    expect(firearmCells({ ...f, active: undefined }, us, english)).toMatchObject({
      twist: '10.0',
      configuration: 'Winter',
    })
    expect(firearmCells(blankFirearm(), metric, english)).toEqual({
      barrel: '',
      twist: '',
      hand: '',
      optic: '',
      zero: '',
      configuration: '',
    })
  })
  it('gives the click value in the turret marking, else in the chosen unit', () => {
    const o = { clickValue: 1e-4 }
    expect(clickText({ ...o, clickUnit: 'mrad' }, us)).toBe('0.10 mrad')
    expect(clickText({ ...o, clickUnit: 'MOA' }, metric)).toBe('0.34 MOA')
    expect(clickText({ ...o, clickValue: undefined }, metric)).toBeUndefined()
  })
})

describe('firearmPatch', () => {
  const now = new Date(2026, 9, 12, 23, 30)
  const counted = { ...blankFirearm(), roundCount: 400, roundCountDate: '2026-01-05' }

  it('dates a changed round count to the local day and drops the date of a cleared one', () => {
    expect(firearmPatch(blankFirearm(), { roundCount: 120 }, now)).toMatchObject({
      roundCount: 120,
      roundCountDate: '2026-10-12',
    })
    expect(firearmPatch(counted, { roundCount: 450 }, now).roundCountDate).toBe('2026-10-12')
    expect(firearmPatch(counted, { roundCount: undefined }, now).roundCountDate).toBeUndefined()
  })

  it('keeps the date on any other edit and on the same count', () => {
    expect(firearmPatch(counted, { notes: 'Cleaned', active: 'c1' }, now)).toMatchObject({
      notes: 'Cleaned',
      roundCountDate: '2026-01-05',
    })
    expect(firearmPatch(counted, { roundCount: 400 }, now).roundCountDate).toBe('2026-01-05')
  })
})

describe('withSessionRounds', () => {
  const now = new Date(2026, 9, 12, 18, 0)
  const a = 'user:00000000-0000-4000-8000-00000000000a'
  const b = 'user:00000000-0000-4000-8000-00000000000b'
  const counted = {
    ...rifle,
    data: { ...rifle.data, roundCount: 400, roundCountDate: '2026-01-05' },
  }
  /** The count after adding the rounds `roundsDue` offers for each step in turn. */
  const countAfter = (steps: { session: string; base: number; shots: number }[]) => {
    let r: UserRecord = { ...rifle, data: { ...rifle.data, roundCount: 100 } }
    for (const s of steps) {
      const due: number = r.kind === 'firearm' ? roundsDue(r.data, s.session, s.base, s.shots) : 0
      r = withSessionRounds(r, s.session, s.base, s.shots, due, now) ?? r
    }
    return r.kind === 'firearm' ? r.data.roundCount : undefined
  }

  it('adds the rounds, dates the count and records them for the session', () => {
    const next = defined(withSessionRounds(counted, a, 400, 10, 12, now))
    expect(next.kind === 'firearm' && next.data).toMatchObject({
      roundCount: 412,
      roundCountDate: '2026-10-12',
      countedSessions: [{ session: a, rounds: 12 }],
    })
    expect(next.saved).toBe(now.toISOString())
  })

  it('skips a session counted already', () => {
    expect(withSessionRounds(counted, a, 390, 10, 10, now)).toBeUndefined()
    expect(withSessionRounds(counted, a, 380, 10, 10, now)).toBeUndefined()
    expect(withSessionRounds(counted, a, 391, 10, 10, now)).toBeDefined()
  })

  it('skips a firearm without a count, a session without a base and no rounds', () => {
    expect(withSessionRounds(rifle, a, 0, 10, 10, now)).toBeUndefined()
    expect(withSessionRounds(counted, a, undefined, 10, 10, now)).toBeUndefined()
    expect(withSessionRounds(counted, a, 400, 10, 0, now)).toBeUndefined()
  })

  it('counts a later shot of a session once', () => {
    expect(
      countAfter([
        { session: a, base: 100, shots: 1 },
        { session: a, base: 100, shots: 2 },
      ]),
    ).toBe(102)
  })

  it('counts a session that began at the count of another one', () => {
    expect(
      countAfter([
        { session: b, base: 100, shots: 1 },
        { session: a, base: 100, shots: 3 },
      ]),
    ).toBe(104)
  })

  it('offers the shots not counted yet and keeps the latest sessions at the limit', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({
      session: `user:00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      rounds: 1,
    }))
    const f = { ...counted.data, countedSessions: [...many.slice(1), { session: a, rounds: 4 }] }
    expect(roundsDue(f, a, undefined, 10)).toBe(6)
    expect(roundsDue(f, a, undefined, 3)).toBe(0)
    const next = defined(withSessionRounds({ ...counted, data: f }, b, 400, 2, 2, now))
    const entries = next.kind === 'firearm' ? (next.data.countedSessions ?? []) : []
    expect(entries).toHaveLength(200)
    expect(entries.at(-1)).toEqual({ session: b, rounds: 2 })
    expect(entries[0]?.session).toBe(many[2]?.session)
  })
})

describe('gunPicker', () => {
  const english = translator().t
  const example = loadExample.firearm
  const names = (rows: { name: string }[]) => rows.map((r) => r.name)
  it('offers the example rifle on a fresh browser and says what to do', () => {
    const picker = gunPicker([], example, english)
    expect(names(picker.rows)).toEqual(['Example rifle, 308 Win. (example)'])
    // its barrel and twist in m for the chooser's columns
    expect(picker.rows[0]?.barrelLength).toBeGreaterThan(0)
    expect(picker.rows[0]?.twist).toBeGreaterThan(0)
    expect(picker.placeholder).toBe(
      'No firearm saved yet. Pick the example rifle, or add yours under Firearms.',
    )
    const german = gunPicker([], example, translator(de as Catalogue, 'de').t)
    expect(german.placeholder).toBe(
      de['No firearm saved yet. Pick the example rifle, or add yours under Firearms.'],
    )
    expect(german.rows[0]?.name).toBe('Example rifle, 308 Win. (Beispiel)')
  })

  it('lists the stored firearms first, the example after them', () => {
    const own = { id: 'own', name: 'My rifle', data: { ...blankFirearm(), name: 'My rifle' } }
    const picker = gunPicker([own], example, english)
    expect(picker.rows.map((r) => r.id)).toEqual(['own', example.id])
    expect(picker.rows[0]).toEqual({
      id: 'own',
      name: 'My rifle',
      barrelLength: undefined,
      twist: undefined,
    })
    expect(picker.placeholder).toBe('Choose a firearm')
  })
})

describe('sightPicker', () => {
  const english = translator().t
  const example = loadExample.firearm as UserRecord
  const exampleLabels = sightOptions([example]).map((o) => `${o.label} (example)`)

  it('offers the example rifle on a fresh browser and says what to do', () => {
    const picker = sightPicker([], example, english)
    expect(picker.options.map((o) => o.label)).toEqual(exampleLabels)
    expect(picker.options[0]?.fill).toEqual(sightOptions([example])[0]?.fill)
    expect(picker.none).toBe(
      'No firearm saved yet. Pick the example rifle, or add yours under Firearms.',
    )
    expect(sightPicker([], example, translator(de as Catalogue, 'de').t).none).toBe(
      de['No firearm saved yet. Pick the example rifle, or add yours under Firearms.'],
    )
  })

  it('lists the stored firearms first, the example after them', () => {
    const picker = sightPicker([rifle], example, english)
    expect(picker.options.map((o) => o.label)).toEqual([
      ...sightOptions([rifle]).map((o) => o.label),
      ...exampleLabels,
    ])
    expect(picker.none).toBe('None')
  })
})

describe('rounds of a competition event', () => {
  const now = new Date(2026, 9, 12, 18, 0)
  const event = 'user:00000000-0000-4000-8000-0000000000e1'
  const session = 'user:00000000-0000-4000-8000-00000000000a'
  const counted = { ...rifle, data: { ...rifle.data, roundCount: 400 } }
  const ringEvent = (series: CompetitionEvent['results']): CompetitionEvent => ({
    date: '2026-10-11',
    eventType: 'catalogue:dsb-meisterschaft',
    level: 'Landesmeisterschaft',
    state: 'completed',
    results: series,
  })

  it('takes the typed rounds, else the shots of ring series that all list them', () => {
    const shots = { method: 'rings' as const, series: [{ shots: [10, 9] }, { shots: [8] }] }
    expect(eventRounds(ringEvent(shots))).toBe(3)
    expect(eventRounds({ ...ringEvent(shots), rounds: 40 })).toBe(40)
    const total = { method: 'rings' as const, series: [{ shots: [10] }, { total: 96 }] }
    expect(eventRounds(ringEvent(total))).toBeUndefined()
    expect(eventRounds(ringEvent({ method: 'hit-factor', stages: [] }))).toBeUndefined()
  })

  it('adds the rounds once, next to the counted sessions', () => {
    const withSession = defined(withSessionRounds(counted, session, 400, 10, 10, now))
    const next = defined(withEventRounds(withSession, event, 60, 60, now))
    expect(next.kind === 'firearm' && next.data).toMatchObject({
      roundCount: 470,
      countedSessions: [
        { session, rounds: 10 },
        { session: event, rounds: 60 },
      ],
    })
    expect(withEventRounds(next, event, 60, 60, now)).toBeUndefined()
    expect(next.kind === 'firearm' && eventRoundsDue(next.data, event, 65)).toBe(5)
  })

  it('adds nothing without a count, to a record that is no firearm, or for no rounds', () => {
    expect(withEventRounds(rifle, event, 60, 60, now)).toBeUndefined()
    expect(withEventRounds(counted, event, 60, 0, now)).toBeUndefined()
    expect(eventRoundsDue({ ...rifle.data, roundCount: undefined } as never, event, 60)).toBe(0)
  })
})
