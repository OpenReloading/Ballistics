import { describe, expect, it } from 'vitest'
import { figureModel, screenEm, screenWidth } from '../src/cartridge/figure.ts'
import { recordFigures } from '../src/cartridge/figures.ts'
import { cipProfile, type Profile } from '../src/cartridge/profile.ts'
import { annotate } from '../src/core/annotate.ts'
import * as face from '../src/core/face.ts'
import {
  arrowheadCorners,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segsCross,
} from '../src/core/geometry.ts'
import { edgeLines, fullSection, steelBand } from '../src/core/section.ts'
import type { Annotation, Layout } from '../src/core/types.ts'
import { defined } from './defined.ts'
import { sheet } from './sheets.ts'

const record = sheet

const side = (file: string, s: 'cartridge' | 'chamber') => {
  const r = record(file)
  return cipProfile(r.values, s, r.table) as Profile
}
/** Screen layout at the smallest text size: the part frame turned, angle texts along +r. */
const lay = (p: Profile, outer?: number, em = face.minEm) =>
  annotate({ points: p.points, annotation: p.annotation, outer }, em, [0, 1], [-1, 80])
const label = (l: Layout, owner: string) => l.labels.find((x) => x.owner === owner)
const rule = (l: Layout, owner: string) =>
  l.segs.filter((s) => s.owner === owner && s.kind === 'rule')
const expectTipsOffOtherTexts = (l: Layout) => {
  for (const t of l.arrowheads)
    for (const m of l.labels)
      if (m.owner !== t.owner)
        expect(
          polygonsOverlap(arrowheadCorners(t), labelCorners(m)),
          `${t.owner} on ${m.owner}`,
        ).toBe(false)
}

describe('annotate', () => {
  const p = side('cip-308-win-2008-09-23', 'cartridge')
  const l = lay(p)
  /** The +r distance of a length's rule from the axis. */
  const lane = (owner: string) => defined(rule(l, owner)[0]).a[1]

  it('stacks the 308 Win. lengths on +r, shortest innermost, S on -r', () => {
    expect(lane('L1')).toBeLessThan(lane('L2'))
    expect(lane('L2')).toBeLessThan(lane('L3'))
    expect(lane('L3')).toBeLessThan(lane('L6'))
    // lane 0 lies 3.0 mm (at 1.6 mm text) beyond the widest radius, R1/2
    expect(lane('L1')).toBeCloseTo(6.005 + (face.firstLaneOffset * face.minEm) / face.baseEm, 9)
    expect(Math.min(...rule(l, 'S').map((s) => s.a[1]))).toBeLessThan(-lane('L6') / 2)
  })

  it('spans the datum along the head face over every lane plus 0.9 mm', () => {
    const datum = l.segs.find((s) => s.owner === 'datum')
    expect(datum?.a[0]).toBe(0)
    expect(datum?.b[1]).toBeCloseTo(lane('L6') + face.overrun, 9)
    expect(datum?.a[1]).toBeLessThan(Math.min(...rule(l, 'S').map((s) => s.a[1])))
  })

  it('centres the alpha arc on the drawn shoulder vertex', () => {
    const arc = l.arcs.find((a) => a.owner === 'alpha')
    expect(arc?.c[0]).toBeCloseTo(55.458, 3)
    expect(arc?.c[1]).toBe(0)
  })

  it('keeps the 308 Win. arrowheads apart and off the texts of other dimensions', () => {
    const tips = (owner: string) =>
      l.arrowheads.filter((t) => t.owner === owner).map(arrowheadCorners)
    for (const [r, d] of [
      ['r1', 'P2'],
      ['r2', 'H1'],
    ] as const)
      for (const a of tips(r)) for (const b of tips(d)) expect(polygonsOverlap(a, b)).toBe(false)
    expectTipsOffOtherTexts(l)
  })

  it('puts the head diameters behind the face, the smaller radius nearer', () => {
    const at = (owner: string) => defined(rule(l, owner)[0]).a[0]
    expect(at('E1')).toBeLessThan(0)
    expect(at('R1')).toBeLessThan(at('E1'))
  })

  it('projects the 378 Weath. Mag. belt R3 from the belt, R1 from the chamfer top', () => {
    const belted = lay(side('cip-378-weath-mag-2002-05-15', 'cartridge'))
    const starts = (owner: string) =>
      belted.segs.filter((s) => s.owner === owner && s.kind === 'thin').map((s) => s.a)
    // the belt reaches R3 15.33 at z 4.22, the rim R1 14.71 at f 0.3 behind the chamfer
    expect(starts('R3')).toEqual([
      [4.22 - face.extensionGap, 7.665],
      [4.22 - face.extensionGap, -7.665],
    ])
    expect(starts('R1')).toEqual([
      [0.3 - face.extensionGap, 7.355],
      [0.3 - face.extensionGap, -7.355],
    ])
  })

  it('breaks a rule that ends past zMax + 0.2 (zMax - zMin), one arrow at the datum end', () => {
    const synthetic: Annotation = {
      dimensions: [
        { kind: 'length', symbol: 'L6', value: 20, from: 0, to: 20 },
        { kind: 'length', symbol: 'L3', value: 10, from: 0, to: 10 },
      ],
      angles: [],
      radii: [],
      edges: [],
      conventions: [],
    }
    const points: Profile['points'] = [
      [0, 0],
      [3, 0],
      [3, 10],
    ]
    const out = annotate({ points, annotation: synthetic }, face.minEm, [0, 1], [-1, 12])
    expect(out.spans.find((s) => s.owner === 'L6')).toMatchObject({ broken: true, length: 12 })
    expect(out.arrowheads.filter((t) => t.owner === 'L6')).toHaveLength(1)
    expect(out.arrowheads.filter((t) => t.owner === 'L3')).toHaveLength(2)
    // the zigzag adds four segments to the rule
    expect(rule(out, 'L6')).toHaveLength(5)
  })

  it('keeps the 458 SOCOM print chamber r2 leader short and off the axis and the length stack', () => {
    const drawn = defined(recordFigures(record('cip-458-socom-2021-11-09'))[0]).drawn
    const chamber = figureModel(drawn, 'print', face.printEm).layers.chamber as Layout
    const leader = chamber.segs.find((s) => s.owner === 'r2' && s.leader)
    if (!leader) throw new Error('no r2 leader')
    const length = Math.hypot(leader.b[0] - leader.a[0], leader.b[1] - leader.a[1])
    expect(length).toBeLessThanOrEqual((3 * face.radiusLeaderLength * face.printEm) / face.baseEm)
    expect(leader.a[1] * leader.b[1]).toBeGreaterThan(0)
    const crossed = chamber.segs.filter(
      (s) =>
        ['L1', 'L2', 'L3', 'datum'].includes(s.owner) && segsCross(leader.a, leader.b, s.a, s.b),
    )
    expect(crossed).toEqual([])
  })

  it('moves a 22 Long Rifle chamber diameter label along the axis where two share a station', () => {
    const drawn = defined(recordFigures(record('cip-22-long-rifle-2024-05-14'))[0]).drawn
    const out = figureModel(drawn, 'screen', face.minEm).layers.chamber as Layout
    const [H2, G1] = [label(out, 'H2'), label(out, 'G1')]
    expect(H2 && G1 && boxesOverlap(H2, G1)).toBe(false)
    // G1 at L3 16.33, its label away from it on a kinked line
    expect(rule(out, 'G1')).toHaveLength(2)
    expect(Math.abs((G1?.c[0] as number) - 16.33)).toBeGreaterThan(1)
  })
})

describe('screenEm', () => {
  const brute = (drawn: Parameters<typeof screenWidth>[0][]) => {
    for (let em = face.minEm; em < 6; em = Math.round(em * 1000 + 5) / 1000)
      if (
        em *
          Math.min(
            face.pxPerMm,
            face.phoneColumn / Math.max(...drawn.map((d) => screenWidth(d, em))),
          ) >=
        face.minTextPx
      )
        return em
    return Number.NaN
  }
  for (const file of [
    'cip-308-win-2008-09-23',
    'cip-22-long-rifle-2024-05-14',
    'cip-8-x-51-r-lebel-2015-05-19',
  ])
    it(`gives ${file} 11 px text at 358 px, at most 3 % above the smallest size that does`, () => {
      const drawn = recordFigures(record(file))
        .filter((f) => f.drawn.length)
        .map((f) => f.drawn)
      const em = screenEm(drawn)
      const width = Math.max(...drawn.map((d) => screenWidth(d, em)))
      expect(em * Math.min(face.pxPerMm, face.phoneColumn / width)).toBeGreaterThanOrEqual(11)
      expect(em).toBeLessThanOrEqual(brute(drawn) * 1.03)
    }, 120_000)
})

describe('section', () => {
  const p = side('cip-308-win-2008-09-23', 'chamber')

  it('mirrors the half profile into one closed outline', () => {
    const full = fullSection(p.points)
    expect(full.length).toBe(2 * p.points.length)
    expect(full[0]).toEqual([0, 0])
    expect(full.at(-1)).toEqual([0, -0])
  })

  it('draws the steel band 3 mm beyond the widest bore radius, its stroke open at the cut end', () => {
    const { outer, sides } = steelBand(p.points, face.minEm)
    expect(outer).toBeCloseTo(6.015 + 3, 9)
    const top = defined(sides[0])
    // the polygon closes along the bore; the stroke leaves out the cut at the bore end
    expect(top.polygon.at(-1)).toEqual([0, outer])
    expect(top.stroke[0]).toEqual([(p.points.at(-1) as [number, number])[1], outer])
    expect(top.stroke.at(-1)).toEqual([(p.points.at(-1) as [number, number])[1], 3.81])
    expect(defined(top.zig[0])[1]).toBe(3.81)
    expect(top.zig.at(-1)?.[1]).toBe(outer)
  })

  it('crosses the section at each edge station, as wide as the widest radius', () => {
    expect(edgeLines([3.85, 39.48], 9)).toEqual([
      [
        [3.85, -9],
        [3.85, 9],
      ],
      [
        [39.48, -9],
        [39.48, 9],
      ],
    ])
  })

  it('keeps one frame for every view and the print life size under 190 mm', () => {
    const drawn = defined(recordFigures(record('cip-308-win-2008-09-23'))[0]).drawn
    const screen = figureModel(drawn, 'screen', face.minEm)
    expect(Object.keys(screen.layers)).toEqual(['cartridge', 'chamber'])
    const print = figureModel(drawn, 'print', face.printEm)
    expect(print.frame[2]).toBeLessThanOrEqual(face.printWidth)
    expect(print.frame[2]).toBeGreaterThan(51.18)
  })
})
