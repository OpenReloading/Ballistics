import { describe, expect, it } from 'vitest'
import * as face from '../src/core/face.ts'
import { fillet } from '../src/core/fillet.ts'
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
import { closedEdges, pairs, unit } from '../src/core/vector.ts'
import { defined } from './defined.ts'

const label = (c: PartPoint, dir: PartPoint = [1, 0], w = 4, h = 2): Label => ({
  text: 't',
  c,
  dir,
  w,
  h,
  owner: 'o',
})
/** A box off the origin and turned off the axes: its centre (10, 5), its direction (0.6, 0.8). */
const turned = label([10, 5], [0.6, 0.8])
/** The point `u` along the direction of `l` and `v` across it from its centre. */
const at = (l: Label, u: number, v: number): PartPoint => [
  l.c[0] + u * l.dir[0] - v * l.dir[1],
  l.c[1] + u * l.dir[1] + v * l.dir[0],
]
const square = (x: number, y: number): PartPoint[] => [
  [x, y],
  [x + 1, y],
  [x + 1, y + 1],
  [x, y + 1],
]
const near = (actual: PartPoint[], expected: PartPoint[]) => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((p, i) => {
    expect(p[0]).toBeCloseTo(defined(expected[i])[0], 9)
    expect(p[1]).toBeCloseTo(defined(expected[i])[1], 9)
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

  it('crosses and misses off the origin', () => {
    expect(segsCross([10, 5], [14, 9], [10, 9], [14, 5])).toBe(true)
    expect(segsCross([10, 9], [14, 5], [10, 5], [14, 9])).toBe(true)
    // the lines meet at (11.5, 6.5), beyond the end (11, 6) of the first segment
    expect(segsCross([10, 5], [11, 6], [13, 5], [10, 8])).toBe(false)
    expect(segsCross([13, 5], [10, 8], [10, 5], [11, 6])).toBe(false)
    // a crossing at (12, 7), halfway along the first segment
    expect(segsCross([10, 5], [14, 9], [11, 9], [13, 5])).toBe(true)
  })

  it('is false when the lines would meet before the start of either segment', () => {
    // the lines meet at (1, 1), behind (2, 2)
    expect(segsCross([2, 2], [3, 3], [0, 2], [2, 0])).toBe(false)
    expect(segsCross([0, 2], [2, 0], [2, 2], [3, 3])).toBe(false)
  })

  it('counts segments meeting end to end at either end of either one as touching', () => {
    // the end of the first on the start of the second, along x then along y
    expect(segsCross([0, 0], [1, 0], [1, 0], [1, 1])).toBe(true)
    expect(segsCross([0, 0], [0, 1], [0, 1], [1, 1])).toBe(true)
    // the start of the first on the end of the second
    expect(segsCross([1, 1], [1, 2], [0, 0], [1, 1])).toBe(true)
    expect(segsCross([0, 1], [1, 1], [0, 0], [0, 1])).toBe(true)
    expect(segsCross([1, 0], [2, 0], [1, -1], [1, 0])).toBe(true)
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

  it('hits and misses a box off the origin and turned off the axes', () => {
    expect(segHitsBox({ a: at(turned, 1.5, -3), b: at(turned, 1.5, 3) }, turned)).toBe(true)
    expect(segHitsBox({ a: at(turned, 2.5, -3), b: at(turned, 2.5, 3) }, turned)).toBe(false)
    expect(segHitsBox({ a: at(turned, -3, 0.5), b: at(turned, 3, 0.5) }, turned)).toBe(true)
    expect(segHitsBox({ a: at(turned, -3, 1.5), b: at(turned, 3, 1.5) }, turned)).toBe(false)
  })

  it('counts a segment that ends on the edge of the box as hitting', () => {
    expect(segHitsBox({ a: [-5, 0], b: [-2, 0] }, box)).toBe(true)
  })

  it('grows the box by the pad along its width and along its height', () => {
    const across = { a: [2.5, -5] as PartPoint, b: [2.5, 5] as PartPoint }
    expect(segHitsBox(across, box)).toBe(false)
    expect(segHitsBox(across, box, 1)).toBe(true)
    // a tall box: the segment comes from beyond the half height but within the pad
    const tall = label([0, 0], [1, 0], 2, 4)
    expect(segHitsBox({ a: [0, 2.5], b: [0, 10] }, tall, 1)).toBe(true)
    expect(segHitsBox({ a: [0, 3.5], b: [0, 10] }, tall, 1)).toBe(false)
  })
})

describe('boxesOverlap', () => {
  it('is true for overlapping boxes and false for boxes only touching', () => {
    expect(boxesOverlap(label([0, 0]), label([3.9, 0]))).toBe(true)
    expect(boxesOverlap(label([0, 0]), label([4, 0]))).toBe(false)
    expect(boxesOverlap(label([4, 0]), label([0, 0]))).toBe(false)
  })

  it('separates on the cross axis of either box where no other axis does', () => {
    // a small square at 45 degrees to the turned box, 1 + 0.354 mm from its centre line at most
    const r = Math.SQRT1_2
    const small = (v: number) =>
      label(at(turned, 0, v), [(0.6 - 0.8) * r, (0.8 + 0.6) * r], 0.5, 0.5)
    expect(boxesOverlap(turned, small(1.3))).toBe(true)
    expect(boxesOverlap(turned, small(1.4))).toBe(false)
    expect(boxesOverlap(small(1.4), turned)).toBe(false)
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

  it('reaches every corner of a box: a diamond at the lower left corner of a square', () => {
    const r = Math.SQRT1_2
    const square2 = label([0, 0], [1, 0], 2, 2)
    expect(boxesOverlap(square2, label([-1.6, -1.6], [r, r], 2, 2))).toBe(true)
    expect(boxesOverlap(label([-1.6, -1.6], [r, r], 2, 2), square2)).toBe(true)
    expect(boxesOverlap(square2, label([-1.8, -1.8], [r, r], 2, 2))).toBe(false)
  })

  it('grows the boxes by half the pad each along their height', () => {
    expect(boxesOverlap(label([0, 0]), label([0, 2.5]))).toBe(false)
    expect(boxesOverlap(label([0, 0]), label([0, 2.5]), 1)).toBe(true)
    expect(boxesOverlap(label([0, 0]), label([0, 3.5]), 1)).toBe(false)
  })

  it('overlaps and separates boxes off the origin and turned off the axes', () => {
    const along = (u: number, v: number, dir = turned.dir) => label(at(turned, u, v), dir)
    expect(boxesOverlap(turned, along(3.9, 0))).toBe(true)
    expect(boxesOverlap(turned, along(4.1, 0))).toBe(false)
    expect(boxesOverlap(turned, along(0, 1.9))).toBe(true)
    expect(boxesOverlap(turned, along(0, 2.1))).toBe(false)
    // a box across the turned one: its half width and the other's half height add up to 3 either way
    const across: PartPoint = [-0.8, 0.6]
    expect(boxesOverlap(turned, along(2.9, 0, across))).toBe(true)
    expect(boxesOverlap(turned, along(3.1, 0, across))).toBe(false)
    expect(boxesOverlap(along(3.1, 0, across), turned)).toBe(false)
    expect(boxesOverlap(turned, along(0, 2.9, across))).toBe(true)
    expect(boxesOverlap(turned, along(0, 3.1, across))).toBe(false)
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

  it('counts polygons exactly the pad apart as clear, in either order', () => {
    expect(polygonsOverlap(square(0, 0), square(1.5, 0), 0.5)).toBe(false)
    expect(polygonsOverlap(square(1.5, 0), square(0, 0), 0.5)).toBe(false)
  })

  it('separates with the pad on the x or y axis where no edge axis does', () => {
    const diamond = (x: number, y: number): PartPoint[] => [
      [x, y + 1],
      [x + 1, y],
      [x, y - 1],
      [x - 1, y],
    ]
    // tips 0.5 apart
    expect(polygonsOverlap(diamond(0, 0), diamond(2.5, 0), 0.4)).toBe(false)
    expect(polygonsOverlap(diamond(0, 0), diamond(2.5, 0), 0.6)).toBe(true)
    expect(polygonsOverlap(diamond(0, 0), diamond(0, 2.5), 0.4)).toBe(false)
    expect(polygonsOverlap(diamond(0, 0), diamond(0, 2.5), 0.6)).toBe(true)
    // exactly the pad apart, in either order
    expect(polygonsOverlap(diamond(0, 0), diamond(2.5, 0), 0.5)).toBe(false)
    expect(polygonsOverlap(diamond(2.5, 0), diamond(0, 0), 0.5)).toBe(false)
  })

  it('reads the closing edge from the last point back to the first', () => {
    // the hypotenuse is the closing edge
    const triangle: PartPoint[] = [
      [0, 2],
      [0, 0],
      [2, 0],
    ]
    expect(polygonsOverlap(triangle, square(1.1, 1.1))).toBe(false)
    expect(polygonsOverlap(square(1.1, 1.1), triangle)).toBe(false)
  })

  it('measures the pad along an edge axis off the origin', () => {
    // the hypotenuse x + y = 22 lies 1 / sqrt(2) = 0.707 from the corner (11.5, 11.5)
    const triangle: PartPoint[] = [
      [10, 12],
      [10, 10],
      [12, 10],
    ]
    expect(polygonsOverlap(triangle, square(11.5, 11.5), 0.6)).toBe(false)
    expect(polygonsOverlap(triangle, square(11.5, 11.5), 0.8)).toBe(true)
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

  it('measures from a box off the origin and turned off the axes', () => {
    expect(boxDistance(turned, at(turned, 0.5, 0.5))).toBe(0)
    expect(boxDistance(turned, at(turned, 3, 0))).toBeCloseTo(1, 12)
    expect(boxDistance(turned, at(turned, 0, -3))).toBeCloseTo(2, 12)
    expect(boxDistance(turned, at(turned, -3, 2))).toBeCloseTo(Math.SQRT2, 12)
  })
})

describe('vector helpers', () => {
  it('gives the unit vector between two points and +x for coincident ones', () => {
    expect(unit([1, 1], [4, 5])).toEqual([0.6, 0.8])
    expect(unit([2, 3], [2, 3])).toEqual([1, 0])
  })

  it('closes a polygon back to its first point and gives no edges for no points', () => {
    expect(closedEdges([])).toEqual([])
    expect(pairs([])).toEqual([])
    expect(closedEdges([1])).toEqual([[1, 1]])
    expect(closedEdges([1, 2, 3])).toEqual([
      [1, 2],
      [2, 3],
      [3, 1],
    ])
  })
})

describe('unit and closedEdges', () => {
  it('give a unit direction of [1, 0] for two equal points and no edges of an empty polygon', () => {
    expect(unit([2, 3], [2, 3])).toEqual([1, 0])
    expect(unit([0, 0], [0, 2])).toEqual([0, 1])
    expect(closedEdges([])).toEqual([])
  })
})

describe('fillet', () => {
  it('keeps the corner of a straight line', () => {
    expect(fillet([0, -1], [0, 0], [0, 1], 0.5)).toEqual([[0, 0]])
  })

  it('draws the quarter arc whose angles cross the negative axis in either direction', () => {
    // centre [0.5, 0.5]: from 180 to 270 degrees, the short way across +-180
    const forward = defined(fillet([0, 1], [0, 0], [1, 0], 0.5, 2) ?? undefined)
    near(forward, [
      [0, 0.5],
      [0.5 - 0.5 * Math.SQRT1_2, 0.5 - 0.5 * Math.SQRT1_2],
      [0.5, 0],
    ])
    near(defined(fillet([1, 0], [0, 0], [0, 1], 0.5, 2) ?? undefined), forward.toReversed())
  })
})
