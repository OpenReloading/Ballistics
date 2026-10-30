import type { Bullet, UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { bulletDrag } from '../src/lib/bullet.ts'
import { cardResult, firearmCardPlans } from '../src/lib/firearm-range-cards.ts'
import { noManufacturerNames } from '../src/lib/manufacturers.ts'
import { trajectoryResult } from '../src/lib/trajectory-input.ts'
import { metersPerYard, presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

const saved = '2026-01-01T00:00:00.000Z'
const rifleId = '0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'
const bareId = '1b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'

const firearm = (id: string, mounted: boolean): UserRecord => ({
  kind: 'firearm',
  id,
  name: id,
  saved,
  data: {
    origin: 'user',
    name: id,
    twist: { value: 254 },
    twistHand: 'right',
    optics: [
      { id: 'o1', kind: 'scope', name: 'Scope', clickValue: { value: 0.1 }, clickUnit: 'mrad' },
    ],
    configurations: [
      {
        id: 'c1',
        name: 'Main',
        mounts: mounted
          ? [{ optic: 'o1', sightHeight: { value: 50 }, zeroRange: { value: 100000 } }]
          : [],
      },
    ],
    active: 'c1',
  },
})

const session = (id: string, date: string | undefined, shots: number[], charge?: number) =>
  ({
    kind: 'session',
    id,
    name: id,
    saved,
    data: {
      origin: 'user',
      ...(date && { date }),
      device: { kind: 'doppler-radar' },
      strings: [
        {
          ...(charge && { variation: { kind: 'charge', value: { value: charge } } }),
          shots: shots.map((v, i) => ({
            velocity: { value: v },
            ...(i === 3 && { excluded: 'misread' }),
          })),
        },
      ],
      provenance: { kind: 'measured', sources: [{ title: id }] },
    },
  }) as UserRecord

const load = (
  name: string,
  firearmId: string,
  sessions: string[],
  bullet?: string,
): UserRecord => ({
  kind: 'load',
  id: name,
  name,
  saved,
  data: {
    origin: 'user',
    firearm: `user:${firearmId}`,
    charge: { value: 2.8 },
    ...(bullet && { bullet }),
    sessions: sessions.map((s) => `user:${s}`),
  },
})

const bullet: Bullet = {
  id: 'example-a-1',
  manufacturer: 'example-a',
  productNumber: '1',
  name: 'Test 175',
  diameter: { value: 7.82 },
  mass: { value: 11.34 },
  length: { value: 31.2 },
  ballisticCoefficients: [{ dragModel: 'G7', value: 0.25 }],
  provenance: { kind: 'published', sources: [{ title: 'Test catalog' }] },
}

describe('range cards of a firearm', () => {
  const records = [
    firearm(rifleId, true),
    firearm(bareId, false),
    // the fourth shot is excluded; the later session wins, the other load's charge string is left out
    session('s1', '2026-03-01', [700, 700, 700]),
    session('s2', '2026-05-01', [800, 810, 820, 999]),
    session('s3', '2026-06-01', [500], 3.1),
    load('B load', rifleId, ['s1', 's2', 's3'], 'catalogue:example-a-1'),
    load('A no bullet', rifleId, ['s1']),
    load('C no session', rifleId, [], 'catalogue:example-a-1'),
    load('D design', rifleId, ['s1'], 'user:2b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'),
    load('E other rifle', bareId, ['s1'], 'catalogue:example-a-1'),
  ]

  it('lists the loads of the firearm by name with the skip reason', () => {
    const plans = firearmCardPlans(records, rifleId)
    expect(plans.map((p) => [p.name, 'reason' in p ? p.reason : 'card'])).toEqual([
      ['A no bullet', 'The bullet is not from the database.'],
      ['B load', 'card'],
      ['C no session', 'No chronograph session with shots.'],
      ['D design', 'The bullet is not from the database.'],
    ])
    expect(firearmCardPlans(records, bareId)).toEqual([
      { id: 'E other rifle', name: 'E other rifle', reason: 'The firearm has no mounted optic.' },
    ])
    expect(firearmCardPlans(records, 'none')).toEqual([])
  })

  it('takes the mean of the kept shots of the latest session of the load as it is', () => {
    const plan = defined(firearmCardPlans(records, rifleId)[1])
    expect('velocity' in plan && plan.velocity).toEqual({
      value: 810,
      shots: 3,
      date: '2026-05-01',
    })
  })

  it('computes the card as the Trajectory tab does from its start values', () => {
    const plan = defined(firearmCardPlans(records, rifleId)[1])
    if (!('bullet' in plan)) throw new Error('no card')
    const us = presetUnits('us')
    const card = cardResult(plan, bullet, noManufacturerNames, us)
    if ('reason' in card) throw new Error(card.reason)
    const drag = bulletDrag(bullet, 'G7')
    if (drag.kind !== 'bands') throw new Error('no drag')
    const expected = trajectoryResult(card.si, drag.projectile, 'right')
    expect(card.tablePoints).toEqual(expected.tablePoints)
    expect(card.zeroRange).toBe(0.1 * 1000)
    // the distances are round in the shown range unit: 0 to 1000 yd by 100 yd
    expect(card.tablePoints.map((p) => p.range).at(-1)).toBeCloseTo(1000 * metersPerYard)
    expect(card.si.muzzleVelocity).toBe(810)
    expect(card.click).toEqual({ value: (0.1 * Math.PI) / 180, unit: 'mrad' })
    expect(card.bulletText).toMatch(/Test 175, G7$/)
  })

  it('takes the G1 BC without a G7 one and names a record without either', () => {
    const plan = defined(firearmCardPlans(records, rifleId)[1])
    if (!('bullet' in plan)) throw new Error('no card')
    const metric = presetUnits('metric-grains')
    const g1 = { ...bullet, ballisticCoefficients: [{ dragModel: 'G1' as const, value: 0.5 }] }
    const card = cardResult(plan, g1, noManufacturerNames, metric)
    expect('bulletText' in card && card.bulletText).toMatch(/, G1$/)
    expect(
      cardResult(plan, { ...bullet, ballisticCoefficients: [] }, noManufacturerNames, metric),
    ).toEqual({
      reason: 'The bullet has no BC in the database.',
    })
  })
})
