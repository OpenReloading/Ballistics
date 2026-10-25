import type { UserRecord } from '@openreloading/schema'
import { toSi, userRecord } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import {
  activeClick,
  blankFirearm,
  cardFacts,
  catalogueCartridgeId,
  clickOptions,
  clickText,
  fieldSi,
  fieldStored,
  firearmCells,
  firearmProblem,
  freeId,
  gunValues,
  sightOptions,
} from '../src/lib/firearm.ts'
import { presetUnits } from '../src/lib/units.ts'

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
    expect(options[1].fill).toEqual({
      sightHeight: 0.04,
      zeroRange: 50,
      twist: 0.254,
      twistHand: 'left',
    })
    expect(options[3].fill).toEqual({ sightHeight: 0.07, zeroRange: 25, twistHand: 'right' })
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
    const [scope, dot] = data.configurations[1].mounts
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
    const [first, second] = sightOptions([withZero])
    expect(first.fill).toMatchObject({ sightHeight: 0.055, ...zeroed })
    // a mount without them leaves the keys out, so a choice empties the fields
    for (const key of Object.keys(zeroed)) expect(second.fill).not.toHaveProperty(key)
  })

  it('does not fill a twist of 0', () => {
    const flat = { ...rifle, data: { ...rifle.data, twist: { value: 0 } } } as UserRecord
    expect(sightOptions([flat])[0].fill).not.toHaveProperty('twist')
  })
})

describe('firearm helpers', () => {
  it('a blank firearm is a valid record once named', () => {
    const r = { kind: 'firearm', id: 'x', name: 'New', saved, data: blankFirearm() }
    expect(userRecord.safeParse(r).success).toBe(true)
    expect(userRecord.safeParse({ ...r, name: '' }).error?.issues[0].path).toEqual(['name'])
  })

  it('names the field and its place when a firearm is not valid, never a path', () => {
    const data = (rifle as Extract<UserRecord, { kind: 'firearm' }>).data
    const [winter, summer] = data.configurations
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
      twist: undefined,
      barrelLength: undefined,
      firearmMass: undefined,
    })
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
  it('names barrel, twist and the first optic of the active configuration with its zero', () => {
    expect(cardFacts({ ...f, barrelLength: { value: 610 } }, metric)).toEqual({
      barrel: '610 mm barrel, 1:254 mm, left',
      sight: 'Scope, zero 100 m',
    })
    expect(cardFacts(f, us).barrel).toBe('1:10.0 in, left')
    expect(
      cardFacts({ ...f, barrelLength: { value: 609.6 } }, presetUnits('metric-grains')).barrel,
    ).toBe('24.00 in barrel, 1:10.0 in, left')
    // no active configuration: the first one; nothing entered: nothing shown
    expect(cardFacts({ ...f, active: undefined }, metric).sight).toBe('Scope, zero 200 m')
    expect(cardFacts(blankFirearm(), metric)).toEqual({ barrel: undefined, sight: undefined })
  })
  it('gives the table cells without units, those of the active configuration', () => {
    expect(firearmCells({ ...f, barrelLength: { value: 610 } }, metric)).toEqual({
      barrel: '610',
      twist: '254',
      hand: 'left',
      optic: 'Scope',
      zero: '100',
      configuration: 'Summer',
    })
    expect(firearmCells({ ...f, active: undefined }, us)).toMatchObject({
      twist: '10.0',
      configuration: 'Winter',
    })
    expect(firearmCells(blankFirearm(), metric)).toEqual({
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
