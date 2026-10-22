import { describe, expect, it } from 'vitest'
import {
  concentricPlane,
  conicOf,
  type Ellipse,
  ellipseOf,
  ellipsePoint,
  fitEllipse,
  largestGap,
  mapConic,
  meanRadius,
  ransacEllipse,
  sampson,
  seededRandom,
} from '../src/lib/ellipse.ts'
import { apply3 } from '../src/lib/target-geometry.ts'

const truth: Ellipse = { centreX: 310, centreY: 205, semiMajor: 120, semiMinor: 70, angle: 0.6 }
const ring = (e: Ellipse, n = 120, from = 0, to = 2 * Math.PI) =>
  Array.from({ length: n }, (_, k) => ellipsePoint(e, from + ((to - from) * k) / n))

describe('fitEllipse', () => {
  it('recovers a drawn ellipse from its points', () => {
    const el = ellipseOf(fitEllipse(ring(truth)) ?? [0, 0, 0, 0, 0, 0])
    expect(el).toBeDefined()
    if (!el) return
    expect(el.centreX).toBeCloseTo(truth.centreX, 6)
    expect(el.centreY).toBeCloseTo(truth.centreY, 6)
    expect(el.semiMajor).toBeCloseTo(truth.semiMajor, 6)
    expect(el.semiMinor).toBeCloseTo(truth.semiMinor, 6)
    // the major axis turns by half a turn without changing the ellipse
    expect(Math.abs(Math.sin(el.angle - truth.angle))).toBeLessThan(1e-6)
  })

  it('recovers an ellipse from a 140 degree arc with 0.3 px noise', () => {
    const rnd = seededRandom(3)
    const pts = ring(truth, 200, 0.4, 0.4 + (140 * Math.PI) / 180).map((p) => ({
      x: p.x + 0.3 * (rnd() - 0.5) * 2,
      y: p.y + 0.3 * (rnd() - 0.5) * 2,
    }))
    const el = ellipseOf(fitEllipse(pts) ?? [0, 0, 0, 0, 0, 0])
    expect(el).toBeDefined()
    if (!el) return
    expect(Math.hypot(el.centreX - truth.centreX, el.centreY - truth.centreY)).toBeLessThan(2)
    expect(Math.abs(meanRadius(el) / meanRadius(truth) - 1)).toBeLessThan(0.02)
  })

  it('needs six points and an ellipse', () => {
    expect(fitEllipse(ring(truth, 5))).toBeUndefined()
    // points on a line fit no ellipse
    expect(fitEllipse(Array.from({ length: 20 }, (_, k) => ({ x: k, y: 2 * k })))).toBeUndefined()
  })

  it('draws an ellipse from its conic and measures a point against it', () => {
    const c = conicOf(truth)
    const el = ellipseOf(c)
    expect(el && meanRadius(el)).toBeCloseTo(meanRadius(truth), 6)
    expect(sampson(c, ellipsePoint(truth, 1))).toBeLessThan(1e-9)
    // 5 px outside the major axis end: about 5 px
    const far = ellipsePoint(truth, 0)
    const out = { x: far.x + 5 * Math.cos(truth.angle), y: far.y + 5 * Math.sin(truth.angle) }
    expect(sampson(c, out)).toBeGreaterThan(4.5)
    expect(sampson(c, out)).toBeLessThan(5.5)
  })
})

describe('ransacEllipse', () => {
  it('fits the ellipse through 40 % points that belong to nothing', () => {
    const rnd = seededRandom(5)
    const good = ring(truth, 150)
    const junk = Array.from({ length: 100 }, () => ({ x: 600 * rnd(), y: 450 * rnd() }))
    const fit = ransacEllipse([...good, ...junk], { tolerance: 1, minPoints: 100 }, seededRandom(2))
    expect(fit).toBeDefined()
    if (!fit) return
    expect(Math.abs(meanRadius(fit.ellipse) / meanRadius(truth) - 1)).toBeLessThan(0.01)
    expect(fit.inliers.filter((i) => i < 150).length).toBeGreaterThanOrEqual(145)
  })

  it('gives nothing without enough support, or for a shape the caller refuses', () => {
    const rnd = seededRandom(8)
    const junk = Array.from({ length: 80 }, () => ({ x: 600 * rnd(), y: 450 * rnd() }))
    expect(ransacEllipse(junk, { tolerance: 1, minPoints: 60 }, seededRandom(1))).toBeUndefined()
    expect(
      ransacEllipse(
        ring(truth),
        { tolerance: 1, minPoints: 50, accept: (e) => e.semiMajor < 100 },
        seededRandom(1),
      ),
    ).toBeUndefined()
  })
})

describe('largestGap', () => {
  it('is the largest angle without a point around the centre', () => {
    const half = ring(
      { centreX: 0, centreY: 0, semiMajor: 10, semiMinor: 10, angle: 0 },
      50,
      0,
      Math.PI,
    )
    expect(largestGap(half, 0, 0)).toBeGreaterThan(Math.PI - 0.2)
    expect(
      largestGap(
        ring({ centreX: 0, centreY: 0, semiMajor: 10, semiMinor: 10, angle: 0 }, 60),
        0,
        0,
      ),
    ).toBeLessThan(0.2)
    expect(largestGap([], 0, 0)).toBeCloseTo(2 * Math.PI, 12)
  })
})

// a homography of the plane (a camera tilted about 40 degrees)
const H = [0.9, 0.35, 410, -0.2, 0.62, 300, 0.0006, 0.0011, 1]
const image = (x: number, y: number) => {
  const q = apply3(H, [x, y, 1])
  return { x: q[0] / q[2], y: q[1] / q[2] }
}
/** The image of the circle of radius r about the origin as a conic, through a fine polyline. */
const circleImage = (r: number) => {
  const c = fitEllipse(
    Array.from({ length: 360 }, (_, k) =>
      image(r * Math.cos((k * Math.PI) / 180), r * Math.sin((k * Math.PI) / 180)),
    ),
  )
  if (!c) throw new Error('no ellipse')
  return c
}

describe('concentricPlane', () => {
  it('finds the centre and the radius ratio of two concentric circles seen in perspective', () => {
    const outer = circleImage(250)
    const inner = circleImage(100)
    const plane = concentricPlane(outer, inner)
    expect(plane).toBeDefined()
    if (!plane) return
    const centre = image(0, 0)
    expect(Math.hypot(plane.centre.x - centre.x, plane.centre.y - centre.y)).toBeLessThan(0.05)
    expect(plane.ratio).toBeCloseTo(2.5, 2)
    // the centre of the ellipses is not the image of the centre
    const e = ellipseOf(outer)
    expect(e && Math.hypot(e.centreX - centre.x, e.centreY - centre.y)).toBeGreaterThan(5)
  })

  it('maps both ellipses onto circles about the origin: ratio 1 to 0.4', () => {
    const outer = circleImage(250)
    const inner = circleImage(100)
    const plane = concentricPlane(outer, inner)
    expect(plane).toBeDefined()
    if (!plane) return
    const a = mapConic(outer, plane.toPlane)
    const b = mapConic(inner, plane.toPlane)
    const [ea, eb] = [a && ellipseOf(a), b && ellipseOf(b)]
    expect(ea && eb).toBeTruthy()
    if (!ea || !eb) return
    expect(Math.hypot(ea.centreX, ea.centreY)).toBeLessThan(1e-6)
    expect(Math.hypot(eb.centreX, eb.centreY)).toBeLessThan(1e-6)
    expect(ea.semiMinor / ea.semiMajor).toBeCloseTo(1, 6)
    expect(eb.semiMinor / eb.semiMajor).toBeCloseTo(1, 6)
    expect(meanRadius(eb) / meanRadius(ea)).toBeCloseTo(0.4, 6)
  })

  it('refuses two circles of nearly one size and conics that are not nested', () => {
    expect(concentricPlane(circleImage(250), circleImage(245))).toBeUndefined()
    const far = conicOf({ centreX: 900, centreY: 900, semiMajor: 30, semiMinor: 20, angle: 0 })
    expect(concentricPlane(circleImage(250), far)).toBeUndefined()
  })
})
