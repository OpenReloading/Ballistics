import type { UserRecord } from '@openreloading/schema'
import { userRecord } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import {
  activeClick,
  blankFirearm,
  cardFacts,
  clickOptions,
  clickText,
  firearmCells,
  firearmProblem,
  freeId,
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
    name: 'Range rifle',
    twist: 0.254,
    twistHand: 'left',
    optics: [
      { id: 'o1', kind: 'scope', name: 'Scope' },
      { id: 'o2', kind: 'redDot', name: 'Dot' },
    ],
    configurations: [
      { id: 'c1', name: 'Winter', mounts: [{ optic: 'o1', sightHeight: 0.05, zeroRange: 200 }] },
      {
        id: 'c2',
        name: 'Summer',
        mounts: [
          { optic: 'o1', sightHeight: 0.055, zeroRange: 100 },
          { optic: 'o2', sightHeight: 0.04, zeroRange: 50 },
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
    name: 'Carbine',
    twistHand: 'right',
    optics: [{ id: 'o1', kind: 'ironSights', name: 'Irons' }],
    configurations: [
      { id: 'c1', name: 'Irons', mounts: [{ optic: 'o1', sightHeight: 0.07, zeroRange: 25 }] },
    ],
  },
}

describe('sightOptions', () => {
  const options = sightOptions([
    rifle,
    carbine,
    { ...carbine, kind: 'workbenchState', data: { siValues: {} } } as UserRecord,
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

  it('fills sight height and zero range of the mount and the twist of the firearm', () => {
    expect(options[1].fill).toEqual({
      sightHeight: 0.04,
      zeroRange: 50,
      twist: 0.254,
      twistHand: 'left',
    })
    expect(options[3].fill).toEqual({ sightHeight: 0.07, zeroRange: 25, twistHand: 'right' })
  })

  it('does not fill a twist of 0', () => {
    const flat = { ...rifle, data: { ...rifle.data, twist: 0 } } as UserRecord
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
          { ...summer, mounts: [summer.mounts[0], { ...dot, zeroRange: 0 }] },
        ],
      }),
    ).toBe('Zero range in configuration Summer, mount 2: must be greater than 0.')
    expect(
      problem({
        configurations: [winter, { ...summer, mounts: [summer.mounts[0], { optic: 'o2' }] }],
      }),
    ).toBe('Sight height above the bore in configuration Summer, mount 2: enter a number.')
    expect(problem({ roundCount: 1.5 })).toBe('Round count: must be a whole number.')
    expect(problem({ firearmMass: 0 })).toBe('Mass: must be greater than 0.')
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

describe('clickOptions', () => {
  it('lists mounted optics with a click value, the active configuration first', () => {
    const scoped = {
      ...rifle,
      data: {
        ...rifle.data,
        optics: [
          { id: 'o1', kind: 'scope', name: 'Scope', clickUnit: 'mrad', clickValue: 1e-4 },
          { id: 'o2', kind: 'redDot', name: 'Dot' },
        ],
      },
    } as UserRecord
    expect(clickOptions([scoped, carbine])).toEqual([
      {
        value: 'r1/c2/0',
        label: 'Range rifle, Summer, Scope (active)',
        click: 1e-4,
        unit: 'mrad',
      },
      { value: 'r1/c1/0', label: 'Range rifle, Winter, Scope', click: 1e-4, unit: 'mrad' },
    ])
  })
})

describe('activeClick', () => {
  it('takes the active configuration only', () => {
    const scoped = (click: number | undefined) =>
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
              mounts: [{ optic: 'o2', sightHeight: 0.04, zeroRange: 50 }],
            },
          ],
        },
      }) as UserRecord
    // the active Summer configuration mounts only the dot, which has no click value
    expect(activeClick(scoped(1e-4))).toBeUndefined()
    expect(activeClick(carbine)).toBeUndefined()
    // without an active configuration the first one counts: Winter mounts the scope
    const first = scoped(1e-4) as Extract<UserRecord, { kind: 'firearm' }>
    expect(activeClick({ ...first, data: { ...first.data, active: undefined } })?.click).toBe(1e-4)
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
    expect(cardFacts({ ...f, barrelLength: 0.61 }, metric)).toEqual({
      barrel: '610 mm barrel, 1:254 mm, left',
      sight: 'Scope, zero 100 m',
    })
    expect(cardFacts(f, us).barrel).toBe('1:10.0 in, left')
    expect(cardFacts({ ...f, barrelLength: 0.6096 }, presetUnits('metric-grains')).barrel).toBe(
      '24.00 in barrel, 1:10.0 in, left',
    )
    // no active configuration: the first one; nothing entered: nothing shown
    expect(cardFacts({ ...f, active: undefined }, metric).sight).toBe('Scope, zero 200 m')
    expect(cardFacts(blankFirearm(), metric)).toEqual({ barrel: undefined, sight: undefined })
  })
  it('gives the table cells without units, those of the active configuration', () => {
    expect(firearmCells({ ...f, barrelLength: 0.61 }, metric)).toEqual({
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
    const o = { id: 'o1', kind: 'scope' as const, name: 'Scope', clickValue: 1e-4 }
    expect(clickText({ ...o, clickUnit: 'mrad' }, us)).toBe('0.10 mrad')
    expect(clickText({ ...o, clickUnit: 'MOA' }, metric)).toBe('0.34 MOA')
    expect(clickText({ ...o, clickValue: undefined }, metric)).toBeUndefined()
  })
})
