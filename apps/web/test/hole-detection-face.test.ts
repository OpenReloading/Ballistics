import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import { autoDetect, detectFromExample, type HoleProposal } from '../src/lib/hole-detection.ts'
import type { RgbaImage } from '../src/lib/image.ts'
import { faceLabel } from '../src/lib/target-face.ts'
import { defined } from './defined.ts'
import { photoScene } from './face-photos.ts'
import { faceById, invert, project, render } from './face-render.ts'

// Hole detection with the face label (`apps/docs/docs/models/hole-detection.md`): the
// outline of the face is the region, the colour axis takes its surroundings from the same kind of
// surface, and a dark mark on the black area or a light one on the paper is print.
// An air rifle face (4.5 mm pellets, 22.75 mm outer radius) with its black area cut down to 12 mm,
// 2.7 holes across: a black centre small enough to pass for holes.
const base = faceById('issf-10m-air-rifle')
const face = { ...base, blackDiameter: { value: 12 } }
const outer = defined(face.rings[0]).diameter.value / 2
const W = 1000
const pxPerMm = (0.45 * W) / outer
const holeMm = 4.5

// six dark holes on the paper, 8 to 20 mm from the centre, and one far outside the face
const rnd = (() => {
  let s = 9
  return () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
})()
const holes = Array.from({ length: 6 }, () => {
  const r = 8 + 12 * rnd()
  const a = 6.28 * rnd()
  return { x: r * Math.cos(a), y: r * Math.sin(a), diameter: holeMm }
})
const outside = { x: 23, y: 20, diameter: holeMm }
const { image, h } = render({
  face,
  camera: { width: W, height: W, pxPerMm, depth: 6 },
  line: 2.2 / pxPerMm,
  noise: 3,
  holes: [...holes, outside],
  holeGrey: 25,
  rings: false,
})
const D = holeMm * pxPerMm
const truth = holes.map((q) => project(h, q))
const far = project(h, outside)
const label = faceLabel({ toFace: invert(h), outer, black: 6 }, holeMm)
const input = { image, pxPerM: pxPerMm * 1000, expectedHoleDiameter: holeMm / 1000 / 0.9 }

const score = (found: readonly HoleProposal[]) => ({
  hits: truth.filter((t) => found.some((p) => Math.hypot(p.x - t.x, p.y - t.y) <= D / 2)).length,
  extra: found.filter(
    (p) =>
      !truth.some((t) => Math.hypot(p.x - t.x, p.y - t.y) <= D / 2) &&
      Math.hypot(p.x - far.x, p.y - far.y) > D / 2,
  ).length,
  outside: found.filter((p) => Math.hypot(p.x - far.x, p.y - far.y) <= D / 2).length,
})

describe('hole detection with the face label', () => {
  it('without it a black centre of 2.7 holes across is proposed as holes (the known risk)', () => {
    const s = score(autoDetect({ ...input, region: label.outline })?.proposals ?? [])
    expect(s.hits).toBe(6)
    expect(s.extra).toBeGreaterThanOrEqual(2)
  })

  it('with it the black area proposes nothing and every hole on the paper is found', () => {
    const s = score(autoDetect({ ...input, face: label })?.proposals ?? [])
    expect(s.hits).toBe(6)
    expect(s.extra).toBe(0)
  })

  it('takes the outline of the face as the region: a hole outside it is not proposed', () => {
    const without = score(autoDetect(input)?.proposals ?? [])
    expect(without.outside).toBe(1)
    const found = autoDetect({ ...input, face: label })
    expect(found && score(found.proposals).outside).toBe(0)
    // the same from an example hole
    const ex = detectFromExample({ ...input, face: label }, defined(truth[0]))
    expect(ex && score(ex.proposals)).toEqual({ hits: 6, extra: 0, outside: 0 })
  })

  it('does not change a run without a face', () => {
    const a = autoDetect(input)?.proposals ?? []
    const b = autoDetect({ ...input, face: undefined })?.proposals ?? []
    expect(b).toEqual(a)
  })
})

// Ring numerals (`apps/docs/docs/models/hole-detection.md`): a 25 m pistol face, light holes on its black
// area, and light numerals (bars of the size of a digit) between the rings on both axes.
describe('hole detection with the numerals of the face', () => {
  const pistol = faceById('issf-25m-precision-50m-pistol')
  const size = 1400
  const scale = (0.45 * size) / 250
  const mm = 7.6
  const seven = [
    { x: 30, y: 20 },
    { x: -45, y: 35 },
    { x: 55, y: -40 },
    { x: -20, y: -55 },
    { x: 15, y: 70 },
    { x: -65, y: -25 },
    { x: 40, y: 60 },
  ]
  // a digit: a bar of 4 x 7 mm
  const digit = (x: number, y: number) => [{ x, y, width: 4, height: 7 }]
  const gaps = [37.5, 62.5, 87.5]
  const marks = gaps
    .flatMap((r) => [digit(r, 0), digit(-r, 0), digit(0, r), digit(0, -r)])
    .flat()
    .map((m) => ({ ...m, grey: 226 }))
  const { image, h } = render({
    face: pistol,
    camera: { width: size, height: size, pxPerMm: scale, depth: 6 },
    line: 1.5 / scale,
    noise: 3,
    holes: seven.map((q) => ({ ...q, diameter: mm })),
    marks,
  })
  const D = mm * scale
  const truth = seven.map((q) => project(h, q))
  const radii = pistol.rings.map((r) => r.diameter.value / 2)
  const geometry = { toFace: invert(h), outer: 250, black: 100, rings: radii }
  const input = { image, pxPerM: scale * 1000, expectedHoleDiameter: mm / 1000 / 0.9 }
  const hits = (found: readonly HoleProposal[]) =>
    truth.filter((t) => found.some((p) => Math.hypot(p.x - t.x, p.y - t.y) <= D / 2)).length
  const extra = (found: readonly HoleProposal[]) =>
    found.filter((p) => !truth.some((t) => Math.hypot(p.x - t.x, p.y - t.y) <= D / 2)).length

  it('are proposed as holes when the label has no rings', () => {
    const found = autoDetect({ ...input, face: { ...faceLabel(geometry, mm), numeral: undefined } })
    expect(extra(found?.proposals ?? [])).toBeGreaterThanOrEqual(3)
  })

  it('are not proposed with it, and every hole is found', () => {
    const found = autoDetect({ ...input, face: faceLabel(geometry, mm) })
    expect(hits(found?.proposals ?? [])).toBe(seven.length)
    expect(extra(found?.proposals ?? [])).toBe(0)
  })

  it('are not proposed from an example hole either', () => {
    const found = detectFromExample({ ...input, face: faceLabel(geometry, mm) }, defined(truth[0]))
    expect(hits(found?.proposals ?? [])).toBe(seven.length)
    expect(extra(found?.proposals ?? [])).toBe(0)
  })
})

/** The photo as a JPEG of `quality` read back, so its artefacts are part of the scene. */
async function viaJpeg(image: RgbaImage, quality: number): Promise<RgbaImage> {
  const raw = Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length)
  const jpeg = await sharp(raw, { raw: { width: image.width, height: image.height, channels: 4 } })
    .jpeg({ quality })
    .toBuffer()
  const { data, info } = await sharp(jpeg).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  }
}

// Print that holes can hide in: a hole on a ring numeral stands where the numerals do, and the
// quarter marks of the bull (light squares of 5 mm where the axes meet the black area's edge) look
// like holes on the black area. Blur, noise and JPEG are part of the scenes.
describe('hole detection with holes on the print of the face', () => {
  const pistol = faceById('issf-25m-precision-50m-pistol')
  const size = 1400
  const scale = (0.45 * size) / 250
  const mm = 7.6
  const D = mm * scale
  const seven = [
    { x: 30, y: 20 },
    { x: -45, y: 35 },
    { x: 55, y: -40 },
    { x: -20, y: -55 },
    { x: 15, y: 70 },
    { x: -65, y: -25 },
    { x: 40, y: 60 },
  ]
  const digit = (x: number, y: number) => [{ x, y, width: 4, height: 7 }]
  const numerals = [37.5, 62.5, 87.5]
    .flatMap((r) => [digit(r, 0), digit(-r, 0), digit(0, r), digit(0, -r)])
    .flat()
    .map((m) => ({ ...m, grey: 226 }))
  const quarter = [
    { x: 96, y: 0 },
    { x: -96, y: 0 },
    { x: 0, y: 96 },
    { x: 0, y: -96 },
  ].map((m) => ({ ...m, width: 5, height: 5, grey: 226 }))
  const radii = pistol.rings.map((r) => r.diameter.value / 2)

  async function scene(extra: { x: number; y: number }[], marks: typeof numerals) {
    const holes = [...seven, ...extra]
    const { image, h } = render({
      face: pistol,
      camera: { width: size, height: size, pxPerMm: scale, depth: 6 },
      line: 1.5 / scale,
      noise: 3,
      blur: 1,
      holes: holes.map((q) => ({ ...q, diameter: mm })),
      marks,
    })
    const truth = holes.map((q) => project(h, q))
    const geometry = { toFace: invert(h), outer: 250, black: 100, rings: radii }
    return {
      truth,
      label: faceLabel(geometry, mm),
      input: {
        image: await viaJpeg(image, 75),
        pxPerM: scale * 1000,
        expectedHoleDiameter: mm / 1000 / 0.9,
      },
    }
  }
  const near = (p: { x: number; y: number }, t: { x: number; y: number }) =>
    Math.hypot(p.x - t.x, p.y - t.y) <= D / 2
  const hits = (found: readonly HoleProposal[], truth: { x: number; y: number }[]) =>
    truth.map((t) => found.some((p) => near(p, t)))
  const extra = (found: readonly HoleProposal[], truth: { x: number; y: number }[]) =>
    found.filter((p) => !truth.some((t) => near(p, t))).length

  describe('a hole on a ring numeral', () => {
    let s: Awaited<ReturnType<typeof scene>>
    beforeAll(async () => {
      // on the numeral between the rings of 50 and 75 mm, and beside the one at 87.5 mm
      s = await scene(
        [
          { x: 62.5, y: 1 },
          { x: 87.5, y: -5 },
        ],
        numerals,
      )
    })

    it('is kept in the automatic run, with the numerals still left out', () => {
      const found = autoDetect({ ...s.input, face: s.label })?.proposals ?? []
      expect(hits(found, s.truth).every(Boolean)).toBe(true)
      expect(extra(found, s.truth)).toBe(0)
    })

    it('is kept from an example hole as well', () => {
      const found = detectFromExample({ ...s.input, face: s.label }, defined(s.truth[0]))
      expect(hits(found?.proposals ?? [], s.truth).every(Boolean)).toBe(true)
      expect(extra(found?.proposals ?? [], s.truth)).toBe(0)
    })
  })

  describe('the quarter marks of the bull', () => {
    let s: Awaited<ReturnType<typeof scene>>
    let onMark: Awaited<ReturnType<typeof scene>>
    beforeAll(async () => {
      s = await scene([], quarter)
      onMark = await scene([{ x: 96, y: 1 }], quarter)
    })

    it('are proposed as holes without the face label of the bull', () => {
      const found = autoDetect({ ...s.input, face: { ...s.label, quarter: undefined } })
      expect(extra(found?.proposals ?? [], s.truth)).toBeGreaterThanOrEqual(3)
    })

    it('are not proposed with it, and every hole is found', () => {
      const found = autoDetect({ ...s.input, face: s.label })?.proposals ?? []
      expect(hits(found, s.truth).every(Boolean)).toBe(true)
      expect(extra(found, s.truth)).toBe(0)
    })

    it('are not proposed from an example hole either', () => {
      const found = detectFromExample({ ...s.input, face: s.label }, defined(s.truth[0]))
      expect(hits(found?.proposals ?? [], s.truth).every(Boolean)).toBe(true)
      expect(extra(found?.proposals ?? [], s.truth)).toBe(0)
    })

    it('leave a hole on one of them proposed', () => {
      const found = autoDetect({ ...onMark.input, face: onMark.label })?.proposals ?? []
      expect(hits(found, onMark.truth).every(Boolean)).toBe(true)
      expect(extra(found, onMark.truth)).toBe(0)
    })
  })
})

// Holes that stand at one angle from three axes, at three radii, are no numerals of a turned face:
// the numerals of a ring stand at one radius on its axes.
describe('hole detection on a face with holes at one angle from the axes', () => {
  const face = faceById('issf-10m-air-pistol')
  const spots: [number, number][] = [
    [61.78, 22.49],
    [-10.03, 56.87],
    [-46.75, -17.02],
    [14.28, -39.23],
    [-63.87, 36.87],
    [16.88, 29.23],
  ]
  const { image, h } = render({
    face,
    camera: { width: 1400, height: 1300, pxPerMm: 7.5, depth: 50 },
    line: 0.8,
    holes: spots.map(([x, y]) => ({ x, y, diameter: 4.5 })),
    holeGrey: 38,
  })
  const geometry = {
    toFace: invert(h),
    outer: defined(face.rings[0]).diameter.value / 2,
    black: face.blackDiameter.value / 2,
    rings: face.rings.map((r) => r.diameter.value / 2),
  }

  it('proposes every hole', () => {
    const found = autoDetect({
      image,
      pxPerM: 7500,
      expectedHoleDiameter: 0.0045,
      face: faceLabel(geometry, 4.5),
    })
    const truth = spots.map(([x, y]) => project(h, { x, y }))
    const hits = truth.filter((t) =>
      found?.proposals.some((p) => Math.hypot(p.x - t.x, p.y - t.y) <= 0.5 * 4.5 * 7.5),
    )
    expect(hits).toHaveLength(spots.length)
  })
})

describe('a flier far from the group on a found face', () => {
  const face = faceById('issf-25m-precision-50m-pistol')
  const group: [number, number][] = [
    [20, 20],
    [32, 20],
    [20, 32],
    [32, 32],
    [26, 8],
  ]
  const flier = { x: -60, y: -40 }
  const { image, h } = render({
    face,
    camera: { width: 1200, height: 1200, pxPerMm: 4, depth: 50 },
    line: 0.6,
    noise: 2,
    holes: [...group.map(([x, y]) => ({ x, y })), flier].map((p) => ({ ...p, diameter: 9 })),
    holeGrey: 205,
  })
  const geometry = {
    toFace: invert(h),
    outer: defined(face.rings[0]).diameter.value / 2,
    black: face.blackDiameter.value / 2,
    rings: face.rings.map((r) => r.diameter.value / 2),
  }
  const input = { image, pxPerM: 4000, expectedHoleDiameter: 0.009, face: faceLabel(geometry, 9) }
  const at = project(h, flier)
  const proposed = (region?: { x: number; y: number }[]) =>
    (autoDetect({ ...input, ...(region && { region }) })?.proposals ?? []).some(
      (p) => Math.hypot(p.x - at.x, p.y - at.y) <= 0.5 * 9 * 4,
    )

  it('is a shot when the face is the region', () => {
    expect(proposed()).toBe(true)
  })

  it('is a stray in a region the user drew', () => {
    const whole = [
      { x: 0, y: 0 },
      { x: 1200, y: 0 },
      { x: 1200, y: 1200 },
      { x: 0, y: 1200 },
    ]
    expect(proposed(whole)).toBe(false)
  })
})

describe('a found face on a sheet half in shadow', () => {
  it('keeps the holes on the shadowed paper', () => {
    const face = faceById('issf-10m-air-rifle')
    const [black, outer] = [face.blackDiameter.value / 2, defined(face.rings[0]).diameter.value / 2]
    const r = (black + outer) / 2
    const s = photoScene(face, 'whole', 4.5)
    s.holes = [0.3, 1.2, 2.2, 3.1, 4.0, 5.2].map((a) => ({
      x: r * Math.cos(a),
      y: r * Math.sin(a),
      diameter: 4.5,
    }))
    s.holeGrey = 30
    // the right part of the photo gets 55 % of the light: its paper falls below Otsu's threshold
    s.light = (x) => (x > 0.55 * s.camera.width ? 0.55 : 1)
    const { image, h } = render(s)
    const geometry = {
      toFace: invert(h),
      outer,
      black,
      rings: face.rings.map((q) => q.diameter.value / 2),
    }
    const px = s.camera.pxPerMm
    const found =
      autoDetect({
        image,
        pxPerM: px * 1000,
        expectedHoleDiameter: 0.0045,
        face: faceLabel(geometry, 4.5),
      })?.proposals ?? []
    const shadowed = s.holes.map((q) => project(h, q)).filter((t) => t.x > 0.55 * s.camera.width)
    expect(shadowed.length).toBeGreaterThan(1)
    for (const t of shadowed)
      expect(found.some((p) => Math.hypot(p.x - t.x, p.y - t.y) <= 0.5 * 4.5 * px)).toBe(true)
  })
})
