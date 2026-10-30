import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  acceptProposals,
  confirmedHoleDiameters,
  type EditorProposal,
  expectedHoleSize,
  isMaybe,
  isNominal,
  localPxPerM,
  proposalsClearOfShots,
  rectangleFromDiagonal,
} from '../src/lib/hole-proposals.ts'
import { type Frame, frameOf, targetToView } from '../src/lib/target-editor.ts'
import { groupStatisticsOf } from '../src/lib/target-groups.ts'
import { defined } from './defined.ts'

// 10 px per mm: the 100 mm line is 1000 px long; target (0, 0) at photo (600, 500)
const group: ShotGroup = {
  id: 'g1',
  name: 'Group 1',
  colour: '#d9480f',
  distance: 100,
  shots: [{ x: 0.01, y: 0.002, placement: 'placed' }],
}
const sheet: TargetSheet = {
  photo: 'p1',
  references: [{ kind: 'line', a: { x: 100, y: 500 }, b: { x: 1100, y: 500 }, length: 0.1 }],
  targetRotation: 0,
  targetOrigin: { x: 600, y: 500 },
  groups: [group],
}
const frame = frameOf(sheet)
if (!frame) throw new Error('no frame')

const proposal = (id: number, x: number, y: number, clusterSize = 1): EditorProposal => ({
  id,
  x,
  y,
  confidence: 0.8 / clusterSize,
  clusterSize,
  clusterId: id,
  diameter: 78,
})

describe('isMaybe and isNominal', () => {
  it('marks a proposal below a confidence of 0.5 as a maybe', () => {
    expect(isMaybe({ confidence: 0.49 })).toBe(true)
    expect(isMaybe({ confidence: 0.5 })).toBe(false)
    expect(isMaybe({ confidence: 0.8 })).toBe(false)
  })

  it('counts a bullet or marker size as nominal, a typed or learned one and none as not', () => {
    expect(isNominal({ source: 'bullet' })).toBe(true)
    expect(isNominal({ source: 'marker' })).toBe(true)
    expect(isNominal({ source: 'typed' })).toBe(false)
    expect(isNominal({ source: 'learned' })).toBe(false)
    expect(isNominal(undefined)).toBe(false)
  })
})

describe('expectedHoleSize', () => {
  const sizes = { bulletDiameter: 0.0078, markerDiameter: 0.006 }

  it('takes the typed size before every other', () => {
    expect(
      expectedHoleSize({ typedDiameter: 0.009, confirmedDiameters: [1, 2, 3], ...sizes }),
    ).toEqual({ diameter: 0.009, source: 'typed' })
  })

  it('learns the median of three or more measured holes, sorted by size', () => {
    expect(expectedHoleSize({ confirmedDiameters: [0.009, 0.007, 0.008], ...sizes })).toEqual({
      diameter: 0.008,
      source: 'learned',
    })
    expect(expectedHoleSize({ confirmedDiameters: [0.01, 0.007, 0.009, 0.008], ...sizes })).toEqual(
      { diameter: expect.closeTo(0.0085, 12), source: 'learned' },
    )
  })

  it('falls back to the bullet, then the marker, then none below three holes', () => {
    expect(expectedHoleSize({ confirmedDiameters: [0.009, 0.007], ...sizes })).toEqual({
      diameter: 0.0078,
      source: 'bullet',
    })
    expect(expectedHoleSize({ confirmedDiameters: [], markerDiameter: 0.006 })).toEqual({
      diameter: 0.006,
      source: 'marker',
    })
    expect(expectedHoleSize({ confirmedDiameters: [] })).toBeUndefined()
  })
})

describe('rectangleOf', () => {
  it('gives the four corners of the rectangle of two opposite corners, clockwise from top left', () => {
    expect(rectangleFromDiagonal({ x: 300, y: 50 }, { x: 100, y: 200 })).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
      { x: 300, y: 200 },
      { x: 100, y: 200 },
    ])
  })
})

describe('localPxPerM', () => {
  it('is the photo scale near the region', () => {
    const region = rectangleFromDiagonal({ x: 500, y: 400 }, { x: 700, y: 600 })
    expect(localPxPerM(frame, region)).toBeCloseTo(10_000, 6)
  })

  it('is taken at the middle of the region, 1 mm forward along x and y, under perspective', () => {
    // photo px = 10 000 * target m / (1 + 10 * x + 10 * y): the scale shrinks along x and y
    const [s, c] = [10_000, 10]
    const tilted: Frame = {
      toImage: [s, 0, 0, 0, s, 0, c, c, 1],
      toTarget: [1 / s, 0, 0, 0, 1 / s, 0, -c / s, -c / s, 1],
    }
    const photo = (x: number, y: number): [number, number] => [
      (s * x) / (1 + c * x + c * y),
      (s * y) / (1 + c * x + c * y),
    ]
    // the middle (200, 150) px is target (0.02, 0.015) / (1 - 0.2 - 0.15) m
    const [x, y, mm] = [0.02 / 0.65, 0.015 / 0.65, 0.001]
    const [ox, oy] = photo(x, y)
    const [ax, ay] = photo(x + mm, y)
    const [bx, by] = photo(x, y + mm)
    const expected = (Math.hypot(ax - ox, ay - oy) + Math.hypot(bx - ox, by - oy)) / 2 / mm
    const region = rectangleFromDiagonal({ x: 100, y: 50 }, { x: 300, y: 250 })
    expect(localPxPerM(tilted, region)).toBeCloseTo(expected, 6)
  })
})

describe('newProposals', () => {
  it('drops proposals within half a hole of a shot of the group, so a second run adds no shot twice', () => {
    // the shot at target (10, 2) mm is photo (700, 480)
    const shot = targetToView(frame, defined(group.shots[0]))
    const list = [proposal(1, shot.x + 30, shot.y), proposal(2, shot.x + 50, shot.y)]
    expect(proposalsClearOfShots(list, group, frame, 78).map((p) => p.id)).toEqual([2])
  })

  it('drops a proposal near any shot and keeps one exactly half a hole away', () => {
    const plain: Frame = {
      toImage: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      toTarget: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    }
    const two: ShotGroup = {
      ...group,
      shots: [
        { x: 0, y: 0, placement: 'placed' },
        { x: 100, y: 0, placement: 'placed' },
      ],
    }
    const list = [proposal(1, 130, 0), proposal(2, 39, 0), proposal(3, 50, 50)]
    expect(proposalsClearOfShots(list, two, plain, 78).map((p) => p.id)).toEqual([2, 3])
  })
})

describe('acceptProposals', () => {
  it('adds shots with origin detected in target m, the hole size of single holes only, and leaves the statistics alone until then', () => {
    const before = groupStatisticsOf(group)
    expect(before.shotCount).toBe(1)
    const list = [proposal(1, 800, 500), proposal(2, 900, 400, 2)]
    const { group: next, added } = acceptProposals(group, list, frame, 10_000)
    expect(added).toBe(2)
    expect(next.shots.slice(1)).toEqual([
      {
        x: expect.closeTo(0.02, 9),
        y: expect.closeTo(0, 9),
        placement: 'detected',
        holeDiameter: 0.0078,
      },
      { x: expect.closeTo(0.03, 9), y: expect.closeTo(0.01, 9), placement: 'detected' },
    ])
    expect(groupStatisticsOf(next).shotCount).toBe(3)
    // the group passed in is unchanged: proposals alone change no statistic
    expect(groupStatisticsOf(group)).toEqual(before)
  })

  it('stops at 1000 shots', () => {
    const full: ShotGroup = {
      ...group,
      shots: Array.from({ length: 999 }, () => ({ x: 0, y: 0, placement: 'placed' as const })),
    }
    const { group: next, added } = acceptProposals(
      full,
      [proposal(1, 800, 500), proposal(2, 900, 500)],
      frame,
      10_000,
    )
    expect(added).toBe(1)
    expect(next.shots).toHaveLength(1000)
  })
})

describe('confirmedHoles', () => {
  it('lists the measured holes of the shots of a group', () => {
    const g: ShotGroup = {
      ...group,
      shots: [
        { x: 0, y: 0, placement: 'detected', holeDiameter: 0.008 },
        { x: 0, y: 0, placement: 'placed' },
        { x: 0, y: 0, placement: 'detected', holeDiameter: 0.0082 },
      ],
    }
    expect(confirmedHoleDiameters(g)).toEqual([0.008, 0.0082])
  })
})
