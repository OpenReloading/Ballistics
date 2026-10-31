import type { Projectile } from '@open-reloading/core'
import type { SessionRecord, ShotGroup } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { linkString, stringChoices } from '../src/lib/chrono-link.ts'
import { ladderImpact } from '../src/lib/ladder-impact.ts'
import { dropSlope } from '../src/lib/ladder-slope.ts'
import { defined } from './defined.ts'

const projectile: Projectile = {
  mass: 0.0109,
  diameter: 0.00782,
  drag: { kind: 'bc', model: 'G7', bands: [{ ballisticCoefficient: 218, minVelocity: 0 }] },
}
const load = { muzzleVelocity: 800, sightHeight: 0.04, zeroRange: 100 }

describe('dropSlope', () => {
  it('is the height gained per m/s of velocity: about g x^2 / v^3 at 100 m', () => {
    const b = defined(dropSlope(load, projectile, 100))
    const flat = (9.80665 * 100 ** 2) / 800 ** 3
    expect(b).toBeGreaterThan(flat * 0.9)
    expect(b).toBeLessThan(flat * 1.4)
  })

  it('grows with the distance and is undefined without a sight height or a zero range', () => {
    expect(defined(dropSlope(load, projectile, 200))).toBeGreaterThan(
      defined(dropSlope(load, projectile, 100)),
    )
    expect(dropSlope({ ...load, sightHeight: undefined }, projectile, 100)).toBeUndefined()
    expect(dropSlope({ ...load, zeroRange: undefined }, projectile, 100)).toBeUndefined()
  })
})

/** A session with one string of `n` shots at `velocity` plus its index in m/s. */
const session = (n: number, velocity: (i: number) => number): SessionRecord =>
  ({
    kind: 'session',
    id: 's1',
    name: 'Day',
    saved: '2026-10-31T00:00:00.000Z',
    data: {
      origin: 'user',
      device: { kind: 'other' },
      strings: [
        { shots: Array.from({ length: n }, (_, i) => ({ velocity: { value: velocity(i) } })) },
      ],
      provenance: { kind: 'measured', sources: [{ title: 'file' }] },
    },
  }) as unknown as SessionRecord

const group = (
  step: number,
  session: SessionRecord,
  y: (i: number) => number,
  shots = 5,
  distance = 100,
): ShotGroup => {
  const [choice] = stringChoices([session])
  return {
    id: `g${step}`,
    name: `Group ${step}`,
    colour: '#000000',
    distance,
    aim: { x: 0, y: 0 },
    ladderStep: step,
    shots: linkString(
      Array.from({ length: shots }, (_, i) => ({ x: 0, y: y(i), placement: 'placed' as const })),
      choice,
    ),
  }
}

describe('ladderImpact', () => {
  const charges = [0.002, 0.0021, 0.0022, 0.0023]
  const sessions = [session(5, (i) => 800 + i)]
  /** Three groups at each of the first `n` steps, the height of a shot following its velocity. */
  const groups = (n: number, offset: (step: number) => number, extra: Partial<ShotGroup> = {}) =>
    Array.from({ length: n * 3 }, (_, k) => ({
      ...group(
        Math.floor(k / 3),
        defined(sessions[0]),
        (i) => 1.9e-4 * i + offset(Math.floor(k / 3)) + 1e-4 * ((i * 7) % 3),
      ),
      id: `g${k}`,
      ...extra,
    }))
  const slope = () => 1.9e-4

  it('shows nothing until a velocity is linked', () => {
    const unlinked = groups(4, () => 0).map((g) => ({
      ...g,
      shots: g.shots.map(({ chrono: _, ...s }) => s),
    }))
    expect(ladderImpact(unlinked, charges, sessions, slope)).toEqual({ status: 'none' })
  })

  it('is flat for a pure drop ladder and raises the note for a stepped one', () => {
    const flat = ladderImpact(
      groups(4, () => 0),
      charges,
      sessions,
      slope,
    )
    expect(flat).toMatchObject({ status: 'ready', varies: false })
    const stepped = ladderImpact(
      groups(4, (s) => s * 2e-3),
      charges,
      sessions,
      slope,
    )
    expect(stepped).toMatchObject({ status: 'ready', varies: true })
    if (stepped.status === 'ready')
      expect(stepped.points.map((p) => p.shots)).toEqual([15, 15, 15, 15])
  })

  it('needs three charges of three groups with five velocities each and an aim point', () => {
    expect(
      ladderImpact(
        groups(2, () => 0),
        charges,
        sessions,
        slope,
      ),
    ).toEqual({ status: 'data' })
    const short = groups(4, () => 0).map((g, k) =>
      k % 3 === 0 ? { ...g, shots: g.shots.slice(0, 4) } : g,
    )
    // every charge keeps two groups: no charge qualifies
    expect(ladderImpact(short, charges, sessions, slope)).toEqual({ status: 'data' })
    const noAim = groups(4, () => 0).map(({ aim: _, ...g }) => g)
    expect(ladderImpact(noAim, charges, sessions, slope)).toEqual({ status: 'data' })
  })

  it('skips an excluded shot and a shot whose chronograph shot is excluded', () => {
    const excluded = groups(4, () => 0).map((g) => ({
      ...g,
      shots: g.shots.map((s, i) => (i === 0 ? { ...s, excluded: true } : s)),
    }))
    // four shots are left in every group
    expect(ladderImpact(excluded, charges, sessions, slope)).toEqual({ status: 'data' })
    const misread = session(5, (i) => 800 + i)
    defined(misread.data.strings[0]).shots[0] = { velocity: { value: 800 }, excluded: 'misread' }
    expect(
      ladderImpact(
        groups(4, () => 0),
        charges,
        [misread],
        slope,
      ),
    ).toEqual({ status: 'data' })
  })

  it('needs one distance for every ladder group and a slope', () => {
    const mixed = groups(4, () => 0)
    mixed[0] = { ...defined(mixed[0]), distance: 50 }
    expect(ladderImpact(mixed, charges, sessions, slope)).toEqual({ status: 'distance' })
    expect(
      ladderImpact(
        groups(4, () => 0),
        charges,
        sessions,
        () => undefined,
      ),
    ).toEqual({ status: 'slope' })
  })
})
