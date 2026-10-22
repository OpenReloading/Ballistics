import { describe, expect, it } from 'vitest'
import * as face from '../src/core/face.ts'
import {
  arrowheadCorners,
  boxDistance,
  boxesOverlap,
  labelCorners,
  polygonsOverlap,
  segHitsBox,
  segsCross,
} from '../src/core/geometry.ts'
import type { PartPoint } from '../src/core/section.ts'
import type { Label } from '../src/core/types.ts'

const label = (c: PartPoint, dir: PartPoint = [1, 0], w = 4, h = 2): Label => ({
  text: 't',
  c,
  dir,
  w,
  h,
  owner: 'o',
})
const square = (x: number, y: number): PartPoint[] => [
  [x, y],
  [x + 1, y],
  [x + 1, y + 1],
  [x, y + 1],
]
const near = (actual: PartPoint[], expected: PartPoint[]) => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((p, i) => {
    expect(p[0]).toBeCloseTo(expected[i][0], 9)
    expect(p[1]).toBeCloseTo(expected[i][1], 9)
  })
}

describe('segsCross', () => {
  it('is true for a proper crossing', () => {
    expect(segsCross([0, 0], [2, 2], [0, 2], [2, 0])).toBe(true)
  })

  it('counts an endpoint on the other segment as touching', () => {
    expect(segsCross([0, 0], [2, 0], [1, 0], [1, 2])).toBe(true)
  })

  it('is false when the lines would meet beyond a segment', () => {
    expect(segsCross([0, 0], [1, 1], [2, 0], [0, 3])).toBe(false)
  })

  it('is false for parallel and for collinear segments, overlapping or not', () => {
    expect(segsCross([0, 0], [2, 0], [0, 1], [2, 1])).toBe(false)
    expect(segsCross([0, 0], [2, 0], [1, 0], [3, 0])).toBe(false)
    expect(segsCross([0, 0], [1, 0], [2, 0], [3, 0])).toBe(false)
  })
})

describe('segHitsBox', () => {
  const box = label([0, 0])

  it('hits a segment through the box and one ending inside it', () => {
    expect(segHitsBox({ a: [-5, 0], b: [5, 0] }, box)).toBe(true)
    expect(segHitsBox({ a: [-5, 0], b: [0, 0] }, box)).toBe(true)
  })

  it('counts a segment along an edge as hitting, and one beside it as clear', () => {
    expect(segHitsBox({ a: [-5, 1], b: [5, 1] }, box)).toBe(true)
    expect(segHitsBox({ a: [-5, 2], b: [5, 2] }, box)).toBe(false)
  })

  it('misses a segment that stops short of the box inside its bounding circle', () => {
    expect(segHitsBox({ a: [-4, 0], b: [-2.1, 0] }, box)).toBe(false)
  })

  it('grows the box by the pad on every side', () => {
    const beside = { a: [-5, 1.5] as PartPoint, b: [5, 1.5] as PartPoint }
    expect(segHitsBox(beside, box)).toBe(false)
    expect(segHitsBox(beside, box, 1)).toBe(true)
  })

  it('follows the direction of the label', () => {
    const upright = label([0, 0], [0, 1])
    expect(segHitsBox({ a: [1.5, -3], b: [1.5, 3] }, upright)).toBe(false)
    expect(segHitsBox({ a: [-3, 1.5], b: [3, 1.5] }, upright)).toBe(true)
  })
})

describe('boxesOverlap', () => {
  it('is true for overlapping boxes and false for boxes only touching', () => {
    expect(boxesOverlap(label([0, 0]), label([3.9, 0]))).toBe(true)
    expect(boxesOverlap(label([0, 0]), label([4, 0]))).toBe(false)
  })

  it('splits the pad between the two boxes', () => {
    expect(boxesOverlap(label([0, 0]), label([4.5, 0]))).toBe(false)
    expect(boxesOverlap(label([0, 0]), label([4.5, 0]), 1)).toBe(true)
    expect(boxesOverlap(label([0, 0]), label([5, 0]), 1)).toBe(false)
  })

  it('uses the axes of a rotated box', () => {
    const upright = label([3, 0], [0, 1])
    expect(boxesOverlap(label([0, 0]), upright)).toBe(false)
    expect(boxesOverlap(label([0, 0]), label([2.9, 0], [0, 1]))).toBe(true)
  })

  it('separates a square from a diamond whose bounding boxes still overlap', () => {
    const r = Math.SQRT1_2
    const square2 = label([0, 0], [1, 0], 2, 2)
    expect(boxesOverlap(square2, label([2, 1.9], [r, r], 2, 2))).toBe(false)
    expect(boxesOverlap(square2, label([2, 0], [r, r], 2, 2))).toBe(true)
  })
})

describe('labelCorners', () => {
  it('lists the corners from (+w/2, +h/2) around the box', () => {
    near(labelCorners(label([1, 2])), [
      [3, 3],
      [3, 1],
      [-1, 1],
      [-1, 3],
    ])
  })

  it('turns the box with its direction', () => {
    near(labelCorners(label([1, 2], [0, 1])), [
      [0, 4],
      [2, 4],
      [2, 0],
      [0, 0],
    ])
  })
})

describe('arrowheadCorners', () => {
  it('gives the tip, then the two ends of the base behind it', () => {
    const { length, width } = face.arrow
    near(arrowheadCorners({ at: [5, 3], dir: [1, 0], owner: 'o' }), [
      [5, 3],
      [5 - length, 3 + width / 2],
      [5 - length, 3 - width / 2],
    ])
    near(arrowheadCorners({ at: [0, 0], dir: [0, -1], owner: 'o' }), [
      [0, 0],
      [width / 2, length],
      [-width / 2, length],
    ])
  })
})

describe('polygonsOverlap', () => {
  it('is true for overlapping polygons and false for polygons only touching', () => {
    expect(polygonsOverlap(square(0, 0), square(0.5, 0.5))).toBe(true)
    expect(polygonsOverlap(square(0, 0), square(1, 0))).toBe(false)
  })

  it('reports polygons nearer than the pad', () => {
    expect(polygonsOverlap(square(0, 0), square(1.3, 0), 0.5)).toBe(true)
    expect(polygonsOverlap(square(0, 0), square(1.3, 0), 0.2)).toBe(false)
  })

  it('separates on an edge axis where the bounding boxes overlap', () => {
    const triangle: PartPoint[] = [
      [0, 0],
      [2, 0],
      [0, 2],
    ]
    expect(polygonsOverlap(triangle, square(1.1, 1.1))).toBe(false)
    expect(polygonsOverlap(triangle, square(0.9, 0.9))).toBe(true)
  })
})

describe('boxDistance', () => {
  it('is 0 inside the box and on its edge', () => {
    expect(boxDistance(label([0, 0]), [0, 0.5])).toBe(0)
    expect(boxDistance(label([0, 0]), [2, 1])).toBe(0)
  })

  it('measures to the nearest edge or corner', () => {
    expect(boxDistance(label([0, 0]), [3, 0])).toBe(1)
    expect(boxDistance(label([0, 0]), [3, 2])).toBeCloseTo(Math.SQRT2, 12)
  })

  it('measures along the direction of the label', () => {
    const upright = label([0, 0], [0, 1])
    expect(boxDistance(upright, [0, 3])).toBe(1)
    expect(boxDistance(upright, [2, 0])).toBe(1)
  })
})
