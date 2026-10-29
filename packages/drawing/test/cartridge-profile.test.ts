import { describe, expect, it } from 'vitest'
import { regionStations } from '../src/cartridge/callouts.ts'
import {
  cipProfile,
  closedFront,
  type Note,
  type Profile,
  shotshellProfile,
  shotshellVariants,
  valueParts,
} from '../src/cartridge/profile.ts'
import { fillet } from '../src/core/fillet.ts'
import type { SectionPoint, SpecValue } from '../src/core/types.ts'
import { defined } from './defined.ts'

const deg = Math.PI / 180

function values(side: 'cartridge' | 'chamber', v: Record<string, number>): SpecValue[] {
  return Object.entries(v).map(([symbol, value]) => ({ side, symbol, quantity: 'length', value }))
}

// alpha 40 deg: the shoulder from P2 11.5 to H1 8.7 runs 1.4 / tan(20 deg) mm
const bottleneck = {
  R1: 12,
  R: 1.4,
  E: 3.85,
  E1: 10.4,
  e: 1.4,
  P1: 11.96,
  P2: 11.5,
  L1: 39.6,
  L2: 39.6 + 1.4 / Math.tan(20 * deg),
  alpha: 40,
  H1: 8.7,
  H2: 8.7,
  L3: 51.2,
  L6: 71.1,
}
const straight = { R1: 12.2, R: 1.24, P1: 12.09, H2: 12.01, L3: 22.81 }

function drawn(p: ReturnType<typeof cipProfile>): Profile {
  if ('missing' in p) throw new Error(`missing ${p.missing}`)
  return p
}

const dimension = (p: Profile, symbol: string) =>
  p.annotation.dimensions.find((d) => d.symbol === symbol)
/** The lengths and chains of the stack, not the head lengths or S. */
const lengths = (p: Profile) =>
  p.annotation.dimensions.filter((d) => d.kind !== 'diameter' && !d.behindHeadFace && !d.far)
const symbols = (p: Profile) => p.annotation.dimensions.map((d) => d.symbol)

describe('profile', () => {
  it('draws a bottleneck case monotone in z, ending at (H2/2, L3)', () => {
    const p = drawn(cipProfile(values('cartridge', bottleneck), 'cartridge'))
    const z = p.points.map(([, z]) => z)
    expect(z).toEqual([...z].sort((a, b) => a - b))
    expect(p.points[0]).toEqual([0, 0])
    expect(p.points.at(-1)).toEqual([4.35, 51.2])
    expect(lengths(p).map((d) => d.symbol)).toEqual(['L1', 'L2', 'L3', 'L6', 'L3\u2212L2'])
    expect(dimension(p, 'L3')?.stored).toMatchObject({ value: 51.2 })
    expect(p.notes).toEqual([])
  })

  it('gives a shoulder at half the angle alpha', () => {
    const p = drawn(cipProfile(values('cartridge', bottleneck), 'cartridge'))
    const i = p.points.findIndex(([r, z]) => r === 5.75 && z === 39.6)
    const [[r0, z0], [r1, z1]] = [defined(p.points[i]), defined(p.points[i + 1])]
    expect(Math.atan((r0 - r1) / (z1 - z0)) / deg).toBeCloseTo(20, 9)
  })

  it('draws a straight wall from P1 to H2 without the bottleneck set', () => {
    const p = drawn(cipProfile(values('cartridge', straight), 'cartridge'))
    expect(p.points).toEqual([
      [0, 0],
      [6.1, 0],
      [6.1, 1.24],
      [6.045, 1.24],
      [6.005, 22.81],
    ])
  })

  it('draws the extractor groove with E, E1 and e', () => {
    const p = drawn(cipProfile(values('cartridge', bottleneck), 'cartridge'))
    expect(p.points.slice(2, 6)).toEqual([
      [6, 1.4],
      [5.2, 1.4],
      [5.2, 2.8],
      [5.98, 3.85],
    ])
    const { e: _, ...noE } = bottleneck
    const q = drawn(cipProfile(values('cartridge', noE), 'cartridge'))
    expect(q.points.some(([r]) => r === 5.2)).toBe(false)
  })

  it('steps to P1 at R without a groove that fits', () => {
    const step = [
      [6.1, 1.24],
      [6.045, 1.24],
    ]
    // E1 and e without E
    const noE = drawn(cipProfile(values('cartridge', { ...straight, E1: 10, e: 1 }), 'cartridge'))
    expect(noE.points.slice(2, 4)).toEqual(step)
    // E without E1 and e
    const noGroove = drawn(cipProfile(values('cartridge', { ...straight, E: 3.6 }), 'cartridge'))
    expect(noGroove.points.slice(2, 4)).toEqual(step)
    expect(dimension(noGroove, 'P1')?.from).toBe(1.24)
    // R + e not below E
    const long = { ...straight, E: 2.24, E1: 10, e: 1 }
    expect(drawn(cipProfile(values('cartridge', long), 'cartridge')).points.slice(2, 4)).toEqual(
      step,
    )
  })

  it('names a groove delta more than 1 degree off E1, e, P1 and E', () => {
    // the groove from E1 10.4 at 2.8 to P1 11.96 at 3.85 runs at 36.6 deg from the axis
    const groove = (delta: number) =>
      drawn(
        cipProfile(
          [...values('cartridge', bottleneck), angle('delta', delta, 'cartridge')],
          'cartridge',
        ),
      )
    expect(groove(36).notes).toEqual([])
    const off = groove(30)
    expect(codes(off.notes)).toEqual(['grooveAngle'])
    expect(off.points.slice(4, 6)).toEqual([
      [5.2, 2.8],
      [5.98, 3.85],
    ])
  })

  it('derives e from delta when e is not published, outside table III', () => {
    // 32 Win. SL and 401 Win. SL: one cone from E1 at R to P1 at E, e from 0 to 0.002 mm
    const sl = { R1: 8.97, R: 1.27, E: 3.49, E1: 8.64, P1: 8.93, H2: 8.84, L3: 32.64 }
    const derived = (v: Record<string, number>, delta: number, table = 'II') =>
      drawn(
        cipProfile(
          [...values('cartridge', v), angle('delta', delta, 'cartridge')],
          'cartridge',
          table,
        ),
      )
    const p = derived(sl, 3.74)
    expect(p.points.slice(2, 6).map(([r, z]) => [r, Number(z.toFixed(4))])).toEqual([
      [4.485, 1.27],
      [4.32, 1.27],
      [4.32, 1.2718],
      [4.465, 3.49],
    ])
    expect(dimension(p, 'P1')?.from).toBe(3.49)
    expect(p.notes).toMatchObject([{ code: 'grooveDerivedE', symbols: ['e', 'delta'] }])
    expect(defined(p.notes[0]).text).toContain('e 0.002 mm')
    const clamped = derived({ ...sl, R: 1.52, E: 4.3, E1: 10.31, P1: 11 }, 7)
    expect(clamped.points.slice(3, 6)).toEqual([
      [5.155, 1.52],
      [5.155, 1.52],
      [5.5, 4.3],
    ])
    expect(defined(clamped.notes[0]).text).toContain('-0.03 mm, drawn as 0')
    // a delta whose cone is longer than E - R draws e 0 and is checked like a stored e
    expect(codes(derived(sl, 2).notes)).toEqual(['grooveDerivedE', 'grooveAngle'])
    // no valid delta, or table III, where delta is the belt cone: a step at R
    for (const [delta, table] of [
      [0, 'II'],
      [90, 'II'],
      [Number.NaN, 'II'],
      [3.74, 'III'],
    ] as const)
      expect(codes(derived(sl, delta, table).notes)).not.toContain('grooveDerivedE')
    expect(derived(sl, 0).points.slice(2, 4)).toEqual([
      [4.485, 1.27],
      [4.465, 1.27],
    ])
  })

  it('draws the 308 Norma Mag. belt and its chamber recess', () => {
    const cartridge = { R1: 13.5, R: 1.25, E1: 11.6, e: 1, R3: 13.5, E: 5.56, P1: 13.03 }
    const chamber = { R1: 13.75, R3: 13.75, E: 5.58, P1: 13.06, H2: 8.75, L3: 65.58 }
    const v = [
      ...values('cartridge', { ...cartridge, P2: 12.45, L1: 52.94, L2: 56.92, H1: 8.65 }),
      ...values('cartridge', { H2: 8.65, L3: 65 }),
      angle('delta', 45, 'cartridge'),
      ...values('chamber', chamber),
    ]
    const c = drawn(cipProfile(v, 'cartridge', 'III'))
    expect(c.points.slice(0, 8).map(([r, z]) => [r, Number(z.toFixed(9))])).toEqual([
      [0, 0],
      [6.75, 0],
      [6.75, 1.25],
      [5.8, 1.25],
      [5.8, 2.25],
      [6.75, 3.2],
      [6.75, 5.56],
      [6.515, 5.56],
    ])
    expect(c.notes).toEqual([])
    expect(drawn(cipProfile(v, 'chamber', 'III')).points.slice(0, 4)).toEqual([
      [0, 0],
      [6.875, 0],
      [6.875, 5.58],
      [6.53, 5.58],
    ])
    // without R3 the groove has no end in table III: a step at R, and delta is not checked
    const noBelt = drawn(
      cipProfile(
        v.filter((x) => x.side !== 'cartridge' || x.symbol !== 'R3'),
        'cartridge',
        'III',
      ),
    )
    expect(noBelt.points.slice(0, 4)).toEqual([
      [0, 0],
      [6.75, 0],
      [6.75, 1.25],
      [6.515, 1.25],
    ])
    expect(codes(noBelt.notes)).toEqual(['beltSkipped'])
  })

  it('adds P0 at L0 for a double taper', () => {
    const p = drawn(
      cipProfile(values('cartridge', { ...straight, P0: 12.05, L0: 10 }), 'cartridge'),
    )
    expect(p.points.slice(3, 6)).toEqual([
      [6.045, 1.24],
      [6.025, 10],
      [6.005, 22.81],
    ])
  })

  it('names a cartridge front past chamber L3 + h by more than 0.3 mm', () => {
    // 22 Long Shot: the crimped front reaches 1.78 mm past the chamber mouth
    const longShot = [
      ...values('cartridge', { L3: 22.38 }),
      ...values('chamber', { L3: 20.45, h: 0.15 }),
    ]
    expect(closedFront(longShot)).toMatchObject({ code: 'closedFront', symbols: ['L3', 'h'] })
    expect(closedFront(longShot)?.text).toContain('1.78 mm past')
    const open = [
      ...values('cartridge', { L3: 20.9 }),
      ...values('chamber', { L3: 20.45, h: 0.15 }),
    ]
    expect(closedFront(open)).toBeUndefined()
  })

  it('names a cartridge L6 below its L3 as a closed front', () => {
    // 45 K Blanc: no chamber L3 is needed, an overall length below the case length is closed
    const blank = values('cartridge', { L3: 18.4, L6: 16.6 })
    expect(closedFront(blank)).toMatchObject({ code: 'closedFront', symbols: ['L3', 'L6'] })
    expect(closedFront(blank)?.text).toContain('L6 16.6 mm is below its L3 18.4 mm')
    expect(closedFront(values('cartridge', { L3: 18.4, L6: 18.4 }))).toBeUndefined()
  })

  it('ends the chamber recess at its own E, else its own R, else the cartridge R', () => {
    const chamber = { R1: 12.22, P1: 12.18, H2: 12.04, L3: 22.81 }
    const ownE = drawn(
      cipProfile(
        [...values('chamber', { ...chamber, R: 1.3, E: 3.6 }), ...values('cartridge', { E: 3 })],
        'chamber',
      ),
    )
    expect(ownE.points.slice(2, 4)).toEqual([
      [6.11, 3.6],
      [6.09, 3.6],
    ])
    expect(ownE.notes).toEqual([])
    const ownR = drawn(
      cipProfile(
        [...values('chamber', { ...chamber, R: 1.3 }), ...values('cartridge', { E: 3, R: 1.2 })],
        'chamber',
      ),
    )
    expect(ownR.points.slice(2, 4)).toEqual([
      [6.11, 1.3],
      [6.09, 1.3],
    ])
    expect(ownR.notes).toEqual([])
    const cartridgeR = drawn(
      cipProfile(
        [...values('chamber', chamber), ...values('cartridge', { E: 3, R: 1.24 })],
        'chamber',
      ),
    )
    expect(cartridgeR.points.slice(2, 4)).toEqual([
      [6.11, 1.24],
      [6.09, 1.24],
    ])
    expect(codes(cartridgeR.notes)).toEqual(['cartridgeR'])
    expect(cipProfile(values('chamber', chamber), 'chamber')).toEqual({ missing: ['R'] })
  })

  it('draws a chamber head narrower than P1 at P1', () => {
    // 458 SOCOM: a rebated rim, chamber R1 below P1
    const p = drawn(
      cipProfile(
        values('chamber', { R1: 12.05, E: 4.35, P1: 13.85, H2: 12.4, L3: 40.39 }),
        'chamber',
      ),
    )
    expect(p.points.slice(0, 4)).toEqual([
      [0, 0],
      [6.925, 0],
      [6.925, 4.35],
      [6.925, 4.35],
    ])
    expect(codes(p.notes)).toEqual(['headBelowP1'])
  })

  it('names the missing base symbols', () => {
    const { P1: _, ...noP1 } = straight
    expect(cipProfile(values('cartridge', noP1), 'cartridge')).toEqual({ missing: ['P1'] })
    expect(cipProfile(values('cartridge', straight), 'chamber')).toEqual({
      missing: ['R1', 'P1', 'L3', 'H2'],
    })
  })

  it('ignores values with a variant', () => {
    const v = values('cartridge', straight).map((x) =>
      x.symbol === 'H2' ? { ...x, variant: 'automatic' } : x,
    )
    expect(cipProfile(v, 'cartridge')).toEqual({ missing: ['H2'] })
  })

  // the leade from G1 7.87 to F 7.62 at 1.75 deg is 4.09 mm long
  const rifle = { R1: 12.22, E: 3.6, P1: 12.18, H2: 8.74, L3: 51.44, G1: 7.87, F: 7.62, h: 0.6 }
  const chamberWith = (v: Record<string, number>, i = 1.75) =>
    drawn(cipProfile([...values('chamber', v), angle('i', i)], 'chamber'))

  it('draws the mouth from H2 at L3 to G1 at L3 + h', () => {
    const p = chamberWith({ ...rifle, G: 6.98 })
    expect(p.points.slice(4, 6)).toEqual([
      [4.37, 51.44],
      [3.935, 51.44 + 0.6],
    ])
  })

  it('takes the mouth from alpha1 without h, a step at 180 degrees', () => {
    const { h: _, ...noH } = rifle
    // (8.74 - 7.87) / 2 / tan(37.5 deg) = 0.567 mm
    const cone = drawn(
      cipProfile(
        [...values('chamber', { ...noH, G: 6.98 }), angle('i', 1.75), angle('alpha1', 75)],
        'chamber',
      ),
    )
    expect(defined(cone.points[5])[1] - 51.44).toBeCloseTo(0.567, 3)
    expect(cone.notes).toEqual([])
    const step = drawn(
      cipProfile(
        [...values('chamber', { ...noH, G: 6.98 }), angle('i', 1.75), angle('alpha1', 180)],
        'chamber',
      ),
    )
    expect(step.points[5]).toEqual([3.935, 51.44])
  })

  it('names a mouth step without h or a valid alpha1', () => {
    const { h: _, ...noH } = rifle
    const mouth = (extra: SpecValue[], v = noH) =>
      drawn(
        cipProfile(
          [...values('chamber', { ...v, G: 6.98 }), angle('i', 1.75), ...extra],
          'chamber',
        ),
      )
    for (const extra of [[], [angle('alpha1', 0)], [angle('alpha1', -1)]]) {
      const p = mouth(extra)
      expect(codes(p.notes)).toEqual(['mouthStep'])
      expect(p.points[5]).toEqual([3.935, 51.44])
    }
    expect(defined(mouth([]).notes[0]).text).toContain('has no h or alpha1')
    expect(defined(mouth([angle('alpha1', 0)]).notes[0]).text).toContain(
      'alpha1 0 is not a cone angle',
    )
    // H2 = G1: nothing to step
    expect(mouth([], { ...noH, H2: 7.87 }).notes).toEqual([])
  })

  it('names h off the alpha1 cone by more than 0.05 mm', () => {
    const v = (h: number) =>
      drawn(
        cipProfile(
          [...values('chamber', { ...rifle, h, G: 6.98 }), angle('i', 1.75), angle('alpha1', 75)],
          'chamber',
        ),
      )
    expect(v(0.6).notes).toEqual([])
    const off = v(0.7)
    expect(codes(off.notes)).toEqual(['mouthCone'])
    expect(defined(off.notes[0]).symbols).toEqual(['h', 'alpha1'])
    expect(defined(off.points[5])[1]).toBeCloseTo(51.44 + 0.7, 9)
  })

  it('draws a G1 stub without G and names nothing', () => {
    const p = chamberWith(rifle)
    expect(p.points.slice(5).map(([r]) => r)).toEqual([3.935, 3.935])
    expect(p.notes).toEqual([])
  })

  it('starts the leade at L3 + s when s is given', () => {
    const p = chamberWith({ ...rifle, s: 2.89, G: 6.98 })
    expect(p.points.at(-3)).toEqual([3.935, 51.44 + 2.89])
    expect(p.points.at(-2)).toEqual([3.81, 51.44 + 6.98])
    expect(p.notes).toEqual([])
  })

  it('derives the leade start from i without s', () => {
    const p = chamberWith({ ...rifle, G: 6.98 })
    const [, z] = p.points.at(-3) as SectionPoint
    expect(51.44 + 6.98 - z).toBeCloseTo(0.125 / Math.tan(1.75 * deg), 9)
    expect(p.notes).toEqual([])
  })

  it('names s and i that disagree by more than 0.1 mm and draws the lengths', () => {
    // s and G leave 3.0 mm for a 4.09 mm leade
    const p = chamberWith({ ...rifle, s: 2.89, G: 5.89 })
    expect(codes(p.notes)).toEqual(['leadeAngle'])
    expect(defined(p.notes[0]).symbols).toEqual(['s', 'i'])
    expect(p.points.at(-3)).toEqual([3.935, 51.44 + 2.89])
  })

  it('clamps a leade start past L3 + G to L3 + G and names it', () => {
    const p = chamberWith({ ...rifle, s: 8, G: 6.98 })
    expect(codes(p.notes)).toEqual(['leadeAngle', 'leadeStartPastG'])
    expect(p.points.slice(-3, -1)).toEqual([
      [3.935, 51.44 + 6.98],
      [3.81, 51.44 + 6.98],
    ])
    expect(defined(p.notes[0]).text).toMatch(/the leade is drawn from 6\.98 mm past L3\.$/)
    expect(defined(p.notes[1]).symbols).toEqual(['s', 'G'])
  })

  it('clamps a leade start before L3 + h to L3 + h and names it', () => {
    const fromS = chamberWith({ ...rifle, s: 0.3, G: 4.39 })
    expect(fromS.points.at(-3)).toEqual([3.935, 51.44 + 0.6])
    expect(codes(fromS.notes)).toEqual(['leadeStartBelowH'])
    expect(defined(fromS.notes[0]).symbols).toEqual(['s', 'h'])
    // without s, G - leade falls before L3 + h
    const derived = chamberWith({ ...rifle, G: 3 })
    expect(derived.points.at(-3)).toEqual([3.935, 51.44 + 0.6])
    expect(codes(derived.notes)).toEqual(['leadeStartBelowH'])
    expect(defined(derived.notes[0]).symbols).toEqual(['G', 'i', 'h'])
    // 0.05 mm before L3 + h is clamped without a note
    const rounded = chamberWith({ ...rifle, G: 0.55 + 0.125 / Math.tan(1.75 * deg) })
    expect(rounded.points.at(-3)).toEqual([3.935, 51.44 + 0.6])
    expect(rounded.notes).toEqual([])
  })

  it.each([0, -1, 90, Number.NaN])('names i of %s and draws a straight leade', (i) => {
    const p = chamberWith({ ...rifle, s: 2.89, G: 6.98 }, i)
    expect(codes(p.notes)).toEqual(['iInvalid'])
    expect(p.points.slice(5, 7)).toEqual([
      [3.935, 51.44 + 0.6],
      [3.81, 51.44 + 6.98],
    ])
    expect(p.points.every(([r, z]) => Number.isFinite(r) && Number.isFinite(z))).toBe(true)
  })

  it('steps at L3 + G when G1 is not above F', () => {
    const p = chamberWith({ ...rifle, F: 7.87, G: 6.98 })
    expect(p.points.slice(5, 8)).toEqual([
      [3.935, 51.44 + 0.6],
      [3.935, 51.44 + 6.98],
      [3.935, 51.44 + 6.98],
    ])
    expect(codes(p.notes)).toEqual(['noLeade'])
  })

  it('draws the 30 Super Carry bore as a step at L3 + G', () => {
    const chamber = { L3: 21.01, R1: 8.77, E: 2.98, P1: 8.74, H2: 8.58, G1: 7.58, G: 1.79, F: 7.7 }
    const p = drawn(cipProfile([...values('chamber', chamber), angle('alpha1', 180)], 'chamber'))
    expect(p.points.slice(4, 8)).toEqual([
      [4.29, 21.01],
      [3.79, 21.01],
      [3.79, 21.01 + 1.79],
      [3.85, 21.01 + 1.79],
    ])
    expect(codes(p.notes)).toEqual(['noLeade'])
    expect(defined(p.notes[0]).symbols).toEqual(['G1', 'F'])
  })

  it('ends the 18 x 81 chamber at H2 at L3 without G1 and names G and F', () => {
    const chamber = { L3: 80.8, R1: 21.95, E: 6.24, P1: 21.95, H2: 19.2, G: 1.85, F: 18 }
    const p = drawn(cipProfile([...values('chamber', chamber), angle('i', 17.97)], 'chamber'))
    expect(p.points.at(-1)).toEqual([9.6, 80.8])
    expect(codes(p.notes)).toEqual(['noG1'])
    expect(defined(p.notes[0]).symbols).toEqual(['G1', 'G', 'F'])
    expect(defined(p.notes[0]).text).toBe(
      'Chamber has no G1: the outline ends at H2 at L3, G 1.85, F 18 mm not drawn.',
    )
  })

  it('draws the 308 Match chamber without a note', () => {
    const chamber = {
      L1: 39.48,
      L2: 43.28,
      L3: 51.44,
      R1: 12.03,
      E: 3.85,
      P1: 11.99,
      P2: 11.56,
      H1: 8.79,
      H2: 8.74,
      G1: 7.84,
      G: 6.98,
      h: 0.59,
      s: 4.26,
      F: 7.62,
    }
    const p = drawn(
      cipProfile(
        [
          ...values('chamber', chamber),
          angle('alpha', 40),
          angle('alpha1', 75),
          angle('i', 2.315833333333333),
          ...values('cartridge', { R: 1.37, E: 3.85, L3: 51.18, 'L3+G': 58.16 }),
        ],
        'chamber',
      ),
    )
    // the cartridge L3+G 58.16 is the cartridge L3 + G; the leade still ends at chamber L3 + G 58.42
    expect(p.notes).toEqual([])
    const [r, z] = p.points.at(-2) as SectionPoint
    expect(r).toBe(3.81)
    expect(z).toBeCloseTo(51.44 + 6.98, 9)
    expect(lengths(p).map((d) => [d.symbol, d.from])).toEqual([
      ['L1', 0],
      ['L2', 0],
      ['L3', 0],
      ['h', 51.44],
      ['G', 51.44],
      ['s', 51.44],
    ])
  })

  // 30-06 Spring.: chamber L3 63.55, cartridge L3 63.35
  const springfield = { ...rifle, L3: 63.55, G: 6.19, h: 0.53 }
  const withSum = (sum: number, cartridgeL3?: number) =>
    drawn(
      cipProfile(
        [
          ...values('cartridge', {
            'L3+G': sum,
            ...(cartridgeL3 === undefined ? {} : { L3: cartridgeL3 }),
          }),
          ...values('chamber', springfield),
          angle('i', 1.75),
        ],
        'chamber',
      ),
    )

  it('names no throatDatum when L3+G is cartridge L3 + G (30-06 Spring.)', () => {
    const p = withSum(69.54, 63.35)
    expect(p.notes).toEqual([])
    expect(p.points.at(-2)).toEqual([3.81, 63.55 + 6.19])
    expect(withSum(69.74, 63.35).notes).toEqual([])
  })

  it('names a cartridge L3+G off both sums and keeps the leade end at chamber L3 + G', () => {
    const p = withSum(70, 63.35)
    expect(codes(p.notes)).toEqual(['throatDatum'])
    expect(defined(p.notes[0]).text).toBe(
      'Cartridge L3+G 70 mm is neither chamber L3 + G 69.74 mm, where the leade ends, nor cartridge L3 + G 69.54 mm.',
    )
    expect(p.points.at(-2)).toEqual([3.81, 63.55 + 6.19])
    // without a cartridge L3 only chamber L3 + G counts
    expect(defined(withSum(69.54).notes[0]).text).toBe(
      'Cartridge L3+G 69.54 mm is not chamber L3 + G 69.74 mm, where the leade ends.',
    )
  })

  it('writes a label as symbol, value, then tolerance or limit', () => {
    const v = { side: 'cartridge', quantity: 'length', value: 11.53 } as const
    expect(valueParts({ ...v, symbol: 'P2', tolerance: { lower: -0.2 } })).toEqual([
      'P2',
      '11.53',
      '-0.2',
    ])
    expect(valueParts({ ...v, symbol: 'r1', value: 0.76, limit: 'min' })).toEqual([
      'r1',
      '0.76',
      'min',
    ])
    expect(valueParts({ ...v, symbol: 'L3', value: 51.18 })).toEqual(['L3', '51.18'])
  })

  it('rounds the 308 Win. r1 and r2 corners with tangent arcs', () => {
    const cartridge = {
      ...{ L1: 39.62, L2: 43.48, L3: 51.18, R: 1.37, R1: 12.01, E: 3.85, E1: 10.39, e: 1.4 },
      ...{ P1: 11.96, P2: 11.53, r1: 0.76, r2: 3.18, H1: 8.72, H2: 8.72 },
    }
    const p = drawn(
      cipProfile([...values('cartridge', cartridge), angle('alpha', 40, 'cartridge')], 'cartridge'),
    )
    expect(p.notes).toEqual([])
    expect(p.points).toHaveLength(25)
    const body: SectionPoint = [5.98, 3.85]
    const p2: SectionPoint = [5.765, 39.62]
    const h1: SectionPoint = [4.36, 43.48]
    const mouth: SectionPoint = [4.36, 51.18]
    expect(p.points.at(-1)).toEqual(mouth)
    expectTangent(p.points.slice(6, 15), 0.76, body, p2, h1)
    expectTangent(p.points.slice(15, 24), 3.18, p2, h1, mouth)
  })

  it('names a shoulder alpha more than 1 degree off the lengths', () => {
    const p = drawn(cipProfile(values('cartridge', { ...bottleneck, alpha: 42 }), 'cartridge'))
    expect(codes(p.notes)).toEqual(['shoulderAngle'])
  })

  it('keeps a corner sharp and names a fillet that does not fit', () => {
    const p = drawn(cipProfile(values('cartridge', { ...bottleneck, r2: 30 }), 'cartridge'))
    expect(codes(p.notes)).toEqual(['filletSkipped'])
    expect(p.points).toContainEqual([4.35, bottleneck.L2])
  })

  it('names a partial shoulder set and draws a straight wall (6,5 x 58 R, r2 added)', () => {
    const v = { R1: 12.75, R: 1.15, P1: 11.1, L2: 47.5, H1: 7.57, H2: 7.57, L3: 58.5, r2: 3 }
    const p = drawn(cipProfile(values('cartridge', v), 'cartridge'))
    expect(codes(p.notes)).toEqual(['shoulderPartial'])
    expect(defined(p.notes[0]).text).toBe(
      'Cartridge L2 47.5, H1 7.57 mm without P2, L1: no shoulder is drawn, the wall runs straight from P1 to H2, r2 not drawn.',
    )
    expect(p.points.slice(-2)).toEqual([
      [5.55, 1.15],
      [3.785, 58.5],
    ])
  })

  it('draws no shoulder and names it when H1 is above P2', () => {
    const p = drawn(cipProfile(values('cartridge', { ...bottleneck, H1: 12 }), 'cartridge'))
    expect(codes(p.notes)).toEqual(['shoulderOrder'])
    expect(p.points.slice(-2)).toEqual([
      [5.98, 3.85],
      [4.35, 51.2],
    ])
  })
})

describe('fillet', () => {
  it('returns null for a radius that does not fit', () => {
    expect(fillet([1, 0], [0, 0], [0, 1], 50)).toBeNull()
    expect(fillet([1, 0], [0, 0], [0, 1], 1.2)).toBeNull()
  })

  it('cuts an arc up to 0.1 mm past a segment end to that end', () => {
    const arc = fillet([1, 0], [0, 0], [0, 1], 1.05) as SectionPoint[]
    expect(defined(arc[0])[0]).toBeCloseTo(1, 9)
    expect(defined(arc[0])[1]).toBeCloseTo(0, 9)
    expect(defined(arc[8])[0]).toBeCloseTo(0, 9)
    expect(defined(arc[8])[1]).toBeCloseTo(1, 9)
    expectTangent(arc, 1, [1, 0], [0, 0], [0, 1])
  })

  it('leaves a straight line as its corner', () => {
    expect(fillet([-1, 0], [0, 0], [1, 0], 1)).toEqual([[0, 0]])
  })

  it('sweeps the short way round a corner whose arc crosses the -x direction', () => {
    // lines to the right of the corner: the arc lies left of its centre, angles 3/4 pi to -3/4 pi
    const arc = fillet([1, 1], [0, 0], [1, -1], 0.5) as SectionPoint[]
    expectTangent(arc, 0.5, [1, 1], [0, 0], [1, -1])
    // its middle sample is the point nearest the corner, r sqrt(2) - r from it on the bisector
    expect(defined(arc[4])[0]).toBeCloseTo(0.5 * Math.SQRT2 - 0.5, 12)
    expect(defined(arc[4])[1]).toBeCloseTo(0, 12)
  })
})

/** Asserts the samples lie on one circle of radius r that touches line a-corner and corner-b. */
function expectTangent(
  arc: SectionPoint[],
  r: number,
  a: SectionPoint,
  corner: SectionPoint,
  b: SectionPoint,
) {
  const [[ax, ay], [bx, by], [cx, cy]] = [defined(arc[0]), defined(arc[4]), defined(arc[8])]
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  const sq = (x: number, y: number) => x * x + y * y
  const ox = (sq(ax, ay) * (by - cy) + sq(bx, by) * (cy - ay) + sq(cx, cy) * (ay - by)) / d
  const oy = (sq(ax, ay) * (cx - bx) + sq(bx, by) * (ax - cx) + sq(cx, cy) * (bx - ax)) / d
  for (const [x, y] of arc) expect(Math.abs(Math.hypot(x - ox, y - oy) - r)).toBeLessThan(1e-9)
  const touches = ([x, y]: SectionPoint, [px, py]: SectionPoint, [qx, qy]: SectionPoint) => {
    const [ux, uy] = [qx - px, qy - py]
    const l = Math.hypot(ux, uy)
    // on the line, and the radius to it square to the line
    expect(Math.abs(ux * (y - py) - uy * (x - px)) / l).toBeLessThan(1e-9)
    expect(Math.abs(ux * (x - ox) + uy * (y - oy)) / l).toBeLessThan(1e-9)
  }
  touches(defined(arc[0]), a, corner)
  touches(defined(arc[8]), corner, b)
}

function angle(
  symbol: string,
  value: number,
  side: 'cartridge' | 'chamber' = 'chamber',
): SpecValue {
  return { side, symbol, quantity: 'angle', value }
}

function codes(notes: Note[]) {
  return notes.map((n) => n.code)
}

describe('shotshell', () => {
  // Cal. 12 values, two of its variants, and the Fe variants that give no figure
  const cal12: SpecValue[] = [
    ...values('cartridge', { d: 20.6, g: 22.45, t: 1.85, h: 20.2 }),
    { side: 'cartridge', symbol: 'l', quantity: 'length', value: 35, variant: '12/35 T' },
    { side: 'cartridge', symbol: 'l', quantity: 'length', value: 69.8, variant: '12/70' },
    { side: 'chamber', symbol: 'Fe', quantity: 'length', value: 0.2, variant: 'bascule' },
  ]
  const mori = values('cartridge', { d: 8.8, g: 10.45, t: 1.45, d2: 8.4, h: 8.35, l1: 10.5 })
  const moriCone = [...mori, ...values('cartridge', { l2: 12, alpha: 15.19, l: 45 })]

  it('lists the variants of l only, or one figure without variants', () => {
    expect(shotshellVariants(cal12)).toEqual(['12/35 T', '12/70'])
    expect(shotshellVariants(moriCone)).toEqual([undefined])
  })

  it('draws the hull of a variant from the rim to h at l', () => {
    const p = drawn(shotshellProfile(cal12, 'cartridge', '12/70'))
    expect(p.points).toEqual([
      [0, 0],
      [11.225, 0],
      [11.225, 1.85],
      [10.3, 1.85],
      [10.1, 69.8],
    ])
    expect(p.annotation.dimensions.map((d) => [d.symbol, d.radius, d.to])).toEqual([
      ['g', 11.225, 0],
      ['d', 10.3, 0],
      ['t', undefined, 1.85],
      ['l', undefined, 69.8],
      ['h', 10.1, 69.8],
    ])
    expect(dimension(p, 'l')?.stored?.variant).toBe('12/70')
    expect(p.notes).toEqual([])
  })

  it('names the missing symbols, also l without the variant', () => {
    expect(shotshellProfile(cal12, 'cartridge')).toEqual({ missing: ['l'] })
    expect(shotshellProfile(cal12.slice(1), 'cartridge', '12/70')).toEqual({ missing: ['d'] })
  })

  it('takes only l from the variant', () => {
    const h: SpecValue = {
      side: 'cartridge',
      symbol: 'h',
      quantity: 'length',
      value: 19,
      variant: '12/70',
    }
    expect(drawn(shotshellProfile([...cal12, h], 'cartridge', '12/70')).points.at(-1)).toEqual([
      10.1, 69.8,
    ])
  })

  it('draws the cone from d at l1 to d2 at l2 and checks alpha', () => {
    const p = drawn(shotshellProfile(moriCone, 'cartridge'))
    expect(p.points.slice(3)).toEqual([
      [4.4, 1.45],
      [4.4, 10.5],
      [4.2, 12],
      [4.175, 45],
    ])
    expect(symbols(p)).toEqual(['g', 'd', 't', 'l', 'h', 'l1', 'l2', 'd2'])
    expect(p.notes).toEqual([])
    const off = drawn(
      shotshellProfile(
        [...moriCone.filter((v) => v.symbol !== 'alpha'), ...values('cartridge', { alpha: 20 })],
        'cartridge',
      ),
    )
    expect(off.notes.map((n) => n.code)).toEqual(['shoulderAngle'])
  })

  it('draws a straight hull without the full cone set and names it', () => {
    const p = drawn(shotshellProfile([...mori, ...values('cartridge', { l: 45 })], 'cartridge'))
    expect(p.points.slice(3)).toEqual([
      [4.4, 1.45],
      [4.175, 45],
    ])
    expect(p.notes.map((n) => [n.code, n.symbols])).toEqual([
      ['shoulderPartial', ['d2', 'l1', 'l2']],
    ])
    const late = drawn(
      shotshellProfile([...mori, ...values('cartridge', { l2: 50, l: 45 })], 'cartridge'),
    )
    expect(late.notes.map((n) => n.code)).toEqual(['shoulderPartial'])
  })

  // Cal. 12 chamber, 12/70: forcing cone from H 20.3 to B 18.2 at the included 10.5 degrees
  const chamber12: SpecValue[] = [
    ...values('chamber', { D: 20.65, G: 22.55, T: 1.85, H: 20.3, B: 18.2 }),
    { side: 'chamber', symbol: 'alpha1', quantity: 'angle', value: 10.5, limit: 'max' },
    { side: 'chamber', symbol: 'L', quantity: 'length', value: 69.9, variant: '12/70' },
  ]
  const cone12 = (20.3 - 18.2) / 2 / Math.tan((10.5 / 2) * deg)

  it('draws the chamber with the forcing cone at the included alpha1, then the bore', () => {
    const p = drawn(shotshellProfile(chamber12, 'chamber', '12/70'))
    expect(p.points).toEqual([
      [0, 0],
      [11.275, 0],
      [11.275, 1.85],
      [10.325, 1.85],
      [10.15, 69.9],
      [9.1, 69.9 + cone12],
      [9.1, 69.9 + cone12 + 0.1 * 69.9],
    ])
    expect(cone12).toBeCloseTo(11.43, 2)
    expect(symbols(p)).toEqual(['G', 'D', 'T', 'L', 'H', 'B'])
    expect(p.notes).toEqual([])
    expect(shotshellProfile(chamber12, 'chamber')).toEqual({ missing: ['L'] })
    // an L without a variant serves every variant
    const single = [...chamber12.filter((v) => v.symbol !== 'L'), ...values('chamber', { L: 70 })]
    expect(dimension(drawn(shotshellProfile(single, 'chamber', '12/70')), 'L')?.to).toBe(70)
  })

  it('draws a step to the bore at alpha1 180 and names a missing alpha1', () => {
    const at = (alpha1?: number) =>
      drawn(
        shotshellProfile(
          [
            ...chamber12.filter((v) => v.symbol !== 'alpha1'),
            ...(alpha1 === undefined ? [] : values('chamber', { alpha1 })),
          ],
          'chamber',
          '12/70',
        ),
      )
    expect(at(180).points.slice(4, 6)).toEqual([
      [10.15, 69.9],
      [9.1, 69.9],
    ])
    expect(at(180).notes).toEqual([])
    for (const alpha1 of [undefined, 0, 200])
      expect(at(alpha1).notes.map((n) => [n.code, n.symbols])).toEqual([['mouthStep', ['alpha1']]])
  })

  it('draws the Mori chamber cone from D1 at L1 to B at L2', () => {
    const p = drawn(
      shotshellProfile(
        values('chamber', {
          D: 8.85,
          G: 10.7,
          T: 1.45,
          D1: 8.8,
          B: 8.38,
          H: 8.38,
          alpha1: 13.3,
          L1: 10.5,
          L2: 12.3,
          L: 45.1,
        }),
        'chamber',
      ),
    )
    expect(p.points.slice(3, 7)).toEqual([
      [4.425, 1.45],
      [4.4, 10.5],
      [4.19, 12.3],
      [4.19, 45.1],
    ])
    expect(symbols(p)).toEqual(['G', 'D', 'T', 'L', 'H', 'L1', 'L2', 'D1'])
    expect(p.notes).toEqual([])
  })
})

describe('head chamfer and r0', () => {
  const head = (v: Record<string, number>) =>
    drawn(cipProfile(values('cartridge', { ...straight, ...v }), 'cartridge'))

  it('insets the head face by f / tan(beta), beta from the face line and f along the axis', () => {
    const p = head({ f: 0.38, beta: 35 })
    const inset = 0.38 / Math.tan(35 * deg)
    expect(defined(p.points[1])[0]).toBeCloseTo(6.1 - inset, 12)
    expect(defined(p.points[1])[1]).toBe(0)
    expect(p.points[2]).toEqual([6.1, 0.38])
    expect(p.points[3]).toEqual([6.1, 1.24])
    expect(p.notes).toEqual([])
    // the beta arc: its vertex on the chamfer foot, one flank along the face, one up the chamfer
    const beta = p.annotation.angles.find((a) => a.symbol === 'beta')
    expect(beta?.vertex).toEqual(p.points[1])
    expect(beta?.flanks).toEqual([
      [6.1, 0],
      [6.1, 0.38],
    ])
    expect(dimension(p, 'f')).toMatchObject({
      kind: 'length',
      from: 0,
      to: 0.38,
      behindHeadFace: true,
    })
  })

  it('names a pair it cannot draw and draws no chamfer', () => {
    for (const beta of [0, 90, -1, Number.NaN]) {
      const p = head({ f: 0.38, beta })
      expect(p.points.slice(0, 3)).toEqual([
        [0, 0],
        [6.1, 0],
        [6.1, 1.24],
      ])
      expect(codes(p.notes)).toEqual(['chamferSkipped'])
      expect(defined(p.notes[0]).symbols).toEqual(['f', 'beta'])
      expect(p.annotation.angles.some((a) => a.symbol === 'beta')).toBe(false)
    }
    // f not below R, f not above 0
    expect(codes(head({ f: 1.24, beta: 35 }).notes)).toEqual(['chamferSkipped'])
    expect(codes(head({ f: 0, beta: 35 }).notes)).toEqual(['chamferSkipped'])
  })

  it('draws nothing and names nothing for f or beta alone', () => {
    for (const v of [{ f: 0.38 }, { beta: 35 }] as Record<string, number>[]) {
      const p = head(v)
      expect(p.points[1]).toEqual([6.1, 0])
      expect(p.notes).toEqual([])
      expect(p.annotation.angles).toEqual([])
    }
  })

  it('rounds the rim corner at the head face with r0', () => {
    const p = head({ r0: 0.5 })
    expect(defined(p.points[1])[0]).toBeCloseTo(5.6, 9)
    expect(defined(p.points[1])[1]).toBeCloseTo(0, 9)
    const end = defined(p.points[9])
    expect(end[0]).toBeCloseTo(6.1, 9)
    expect(end[1]).toBeCloseTo(0.5, 9)
    expect(p.points[10]).toEqual([6.1, 1.24])
    expectTangent(p.points.slice(1, 10), 0.5, [0, 0], [6.1, 0], [6.1, 1.24])
    expect(p.annotation.radii).toMatchObject([{ symbol: 'r0', corner: [6.1, 0] }])
    expect(p.notes).toEqual([])
  })

  it('keeps the head callout station in the middle of the rim behind a chamfer or r0', () => {
    for (const v of [{}, { f: 0.38, beta: 35 }, { r0: 0.5 }] as Record<string, number>[])
      expect(regionStations(head(v)).head).toBe(0.62)
  })

  it('names an r0 that does not fit, and an r0 beside a drawn chamfer', () => {
    const big = head({ r0: 3 })
    expect(big.points[1]).toEqual([6.1, 0])
    expect(codes(big.notes)).toEqual(['filletSkipped'])
    const both = head({ f: 0.38, beta: 35, r0: 0.3 })
    expect(both.points[2]).toEqual([6.1, 0.38])
    expect(codes(both.notes)).toEqual(['filletSkipped'])
    expect(defined(both.notes[0]).symbols).toEqual(['r0'])
    expect(both.annotation.radii).toEqual([])
  })
})
