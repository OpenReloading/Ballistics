import type { TargetFace } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { meanRadius } from '../src/lib/ellipse.ts'
import {
  type FaceFit,
  faceLabel,
  findFace,
  fitDiameter,
  fitPicked,
  matchFaces,
  onPhoto,
} from '../src/lib/target-face.ts'
import { apply3 } from '../src/lib/target-geometry.ts'
import { photoScene } from './face-photos.ts'
import { faceById, faces, invert, project, render, type Scene } from './face-render.ts'

// Face recognition on photos drawn from the records of packages/data/records/target-faces:
// the face on a 1200 x 900 px photo, its rings 2.2 px wide, seen by a
// pinhole camera at three views, with noise. The truth is the camera's homography.
const W = 1200
const H = 900

const views = [
  { name: 'front', tilt: 0, yaw: 0, roll: 0, noise: 2 },
  { name: 'tilt 25 degrees, rolled 20', tilt: 25, yaw: 0, roll: 20, noise: 3 },
  { name: 'tilt 40, yaw 20, rolled -30', tilt: 40, yaw: 20, roll: -30, noise: 3 },
]

/**
 * Faces the photo cannot tell apart: their rings are in the same ratios, only the size differs.
 * The user sees the editor ask which face (the event or the distance tells them apart); for every
 * other face the editor applies the one fit without a question.
 */
const twinGroups = [
  ['issf-300m-rifle', 'bdmp-nr1-100m', 'bdmp-nr1-50m', 'bdmp-nr1-25m'],
  ['bdmp-nr6', 'bdmp-nr7', 'bds-z18-pg'],
  ['bdmp-nr8', 'bds-z19-300m-pg'],
  ['bdmp-nr9', 'bdmp-nr10'],
  ['bds-z2-50m-zf', 'bds-z4-100m-zf'],
  ['vdrbw-bw-nr2', 'vdrbw-bw-nr2-klein'],
]
/**
 * Faces offered with one that is no ratio twin: the rings of Z21 (5 rings, steps of 1/5 of the
 * outer radius) are a subset of those of Nr. 5 (6 rings, steps of 1/6) relative to the black, so a
 * Z21 photo cannot exclude Nr. 5, while a Nr. 5 photo is sure. Nr. 8 and Z19 stand to the DSB
 * Nr. 6 as Z21 to Nr. 5.
 */
const alsoOffered: Record<string, string[]> = {
  'bds-z21-25m-buechse': ['bdmp-nr5'],
  'bdmp-nr8': ['dsb-nr6-musket-50m'],
  'bds-z19-300m-pg': ['dsb-nr6-musket-50m'],
}
/** The ids the editor may offer for a face: its twins, and what `alsoOffered` adds. */
const offered = (id: string) => [
  ...(twinGroups.find((g) => g.includes(id)) ?? [id]),
  ...(alsoOffered[id] ?? []),
]

function scene(face: TargetFace, v: (typeof views)[number], extra: Partial<Scene> = {}): Scene {
  const outer = face.rings[0].diameter.value / 2
  const pxPerMm = (0.42 * Math.min(W, H)) / outer
  return {
    face,
    camera: { width: W, height: H, pxPerMm, tilt: v.tilt, yaw: v.yaw, roll: v.roll, depth: 5 },
    line: 2.2 / pxPerMm,
    noise: v.noise,
    ...extra,
  }
}

/** Where a fit puts the truth: the centre, and the distances of points about the centre, in mm. */
function error(fit: FaceFit, h: number[], outer: number) {
  const at = (p: { x: number; y: number }) => {
    const i = project(h, p)
    const q = apply3(fit.toFace as number[], [i.x, i.y, 1])
    return { x: q[0] / q[2], y: q[1] / q[2] }
  }
  const centre = Math.hypot(at({ x: 0, y: 0 }).x, at({ x: 0, y: 0 }).y)
  let radial = 0
  for (const r of [0.3, 0.6, 0.9])
    for (const a of [0, 1.1, 2.3, 4]) {
      const p = { x: r * outer * Math.cos(a), y: r * outer * Math.sin(a) }
      radial = Math.max(radial, Math.abs(Math.hypot(at(p).x, at(p).y) - r * outer))
    }
  return { centre, radial }
}

describe('findFace on drawn faces', () => {
  for (const face of faces.filter((f) => f.photoSearch !== false))
    for (const v of views)
      it(`${face.id}, ${v.name}: the face, its centre and its scale`, () => {
        const s = scene(face, v)
        const { image, h } = render(s)
        const found = findFace(image, faces)
        const fit = found.fits.find((f) => f.face.id === face.id)
        expect(fit).toBeDefined()
        if (!fit) return
        // only the listed twins may be offered with the face, and then the editor asks
        expect(found.fits.every((f) => offered(face.id).includes(f.face.id))).toBe(true)
        expect(found.sure).toBe(found.fits.length === 1)
        // any other face is the first fit, alone and sure
        if (offered(face.id).length === 1) {
          expect(found.fits[0].face.id).toBe(face.id)
          expect(found.fits).toHaveLength(1)
          expect(found.sure).toBe(true)
        }
        const outer = face.rings[0].diameter.value / 2
        const e = error(fit, h, outer)
        // within 0.5 % of the outer radius: a few tenths of a pixel on these photos
        expect(e.centre).toBeLessThan(0.005 * outer)
        expect(e.radial).toBeLessThan(0.007 * outer)
        expect(fit.approximate).toBe(false)
        expect(fit.rms).toBeLessThan(0.01 * (face.blackDiameter.value / 2))
        // the scale at the centre: the camera's px per mm there
        const i0 = project(h, { x: 0, y: 0 })
        const ex = project(h, { x: 1, y: 0 })
        const ey = project(h, { x: 0, y: 1 })
        const local = Math.sqrt(
          Math.abs((ex.x - i0.x) * (ey.y - i0.y) - (ex.y - i0.y) * (ey.x - i0.x)),
        )
        expect(Math.abs(fit.pxPerMm / local - 1)).toBeLessThan(0.01)
      })

  it('never offers a face with photoSearch false, also on a photo of that face', () => {
    const skipped = faces.filter((f) => f.photoSearch === false)
    expect(skipped.length).toBeGreaterThan(0)
    // a skipped copy of a face the search finds: the record itself is found, the copy never
    const face = faceById('issf-25m-rapid-fire-pistol')
    const copy = { ...face, id: 'skipped-copy', photoSearch: false }
    for (const f of [...skipped, copy]) {
      const found = findFace(render(scene(f, views[0])).image, [...faces, copy])
      const ids = [...found.fits.map((x) => x.face.id), ...found.ranked.map((x) => x.id)]
      expect(ids).not.toContain(f.id)
      if (f === copy) expect(found.fits[0]?.face.id).toBe(face.id)
    }
  })

  it('rectifies: under tilt the black ellipse centre is off by millimetres, the fit centre is not', () => {
    const face = faceById('issf-25m-rapid-fire-pistol')
    const { image, h } = render(scene(face, views[2]))
    const found = findFace(image, faces)
    const fit = found.fits[0]
    expect(fit && found.black).toBeTruthy()
    if (!(fit && found.black)) return
    const truth = project(h, { x: 0, y: 0 })
    const px = fit.pxPerMm
    const naive = Math.hypot(found.black.centreX - truth.x, found.black.centreY - truth.y) / px
    const fitted = Math.hypot(fit.centre.x - truth.x, fit.centre.y - truth.y) / px
    expect(naive).toBeGreaterThan(5)
    expect(fitted).toBeLessThan(1)
  })

  it('keeps the outer rings apart on a close photo tilted 50 degrees', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const s = photoScene(face, 'whole', 9)
    s.camera = { ...s.camera, tilt: 50, yaw: 25, depth: 1.2 }
    const found = findFace(render(s).image, faces)
    expect(found.sure).toBe(true)
    expect(found.fits[0]?.face.id).toBe(face.id)
  })

  it('keeps the face when holes pierce it and a dark patch hides part of it', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const s = scene(face, views[1], {
      holes: [
        { x: 12, y: -6, diameter: 9 },
        { x: -40, y: 30, diameter: 9 },
        { x: 70, y: 85, diameter: 9 },
      ],
      holeGrey: 150,
      // a pistol-sized dark patch over the edge of the face
      patches: [{ box: [800, 560, 1000, 700], grey: 25 }],
    })
    const { image, h } = render(s)
    const fit = findFace(image, faces).fits[0]
    expect(fit?.face.id).toBe(face.id)
    if (fit) expect(error(fit, h, 250).centre).toBeLessThan(2)
  })

  it('proposes two faces whose rings the photo cannot tell apart', () => {
    const base = faceById('issf-25m-precision-50m-pistol')
    // a neighbour whose rings and black area are 1.6 % larger
    const scale = (v: { value: number }) => ({ ...v, value: v.value * 1.016 })
    const twin: TargetFace = {
      ...base,
      id: 'twin',
      name: 'Twin',
      blackDiameter: scale(base.blackDiameter),
      rings: base.rings.map((r) => ({ ...r, diameter: scale(r.diameter) })),
      ...(base.innerTen && {
        innerTen: { ...base.innerTen, diameter: scale(base.innerTen.diameter) },
      }),
    }
    const { image } = render(scene(base, views[0]))
    const found = findFace(image, [base, twin])
    // twins are a question for the user
    expect(found.sure).toBe(false)
    expect(found.fits.map((f) => f.face.id).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual([
      'issf-25m-precision-50m-pistol',
      'twin',
    ])
    // the rings cannot tell them apart; each fit has its own scale, 1.6 % apart
    const [x, y] = found.fits.map((f) => f.pxPerMm)
    expect(Math.max(x, y) / Math.min(x, y)).toBeCloseTo(1.016, 3)
  })
})

describe('findFace with a known scale', () => {
  const base = faceById('issf-25m-precision-50m-pistol')
  const times = (v: { value: number }, k: number) => ({ ...v, value: v.value * k })
  // the same ring ratios at three times the size
  const large: TargetFace = {
    ...base,
    id: 'large',
    name: 'Large',
    blackDiameter: times(base.blackDiameter, 3),
    rings: base.rings.map((r) => ({ ...r, diameter: times(r.diameter, 3) })),
    ...(base.innerTen && {
      innerTen: { ...base.innerTen, diameter: times(base.innerTen.diameter, 3) },
    }),
  }
  const sc = scene(base, views[0])
  const { image } = render(sc)
  const ids = (f: ReturnType<typeof findFace>) => f.fits.map((x) => x.face.id).sort()

  it('offers faces of equal ring ratios and different size as a tie without a scale', () => {
    const found = findFace(image, [base, large])
    expect(ids(found)).toEqual(['issf-25m-precision-50m-pistol', 'large'])
    expect(found.sure).toBe(false)
  })

  it('takes the face of the scale of the photo', () => {
    const found = findFace(image, [base, large], sc.camera.pxPerMm)
    expect(ids(found)).toEqual(['issf-25m-precision-50m-pistol'])
    expect(ids(findFace(image, [base, large], sc.camera.pxPerMm / 3))).toEqual(['large'])
  })

  it('proposes the ISSF 25 m precision face, or a tie that contains it, among all faces', () => {
    expect(ids(findFace(image, faces))).toContain('issf-25m-precision-50m-pistol')
  })
})

describe('findFace without a face', () => {
  it('finds nothing on blank paper with noise and a gradient', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const { image } = render({
      ...scene(face, views[0], { noise: 4, gradient: 0.3 }),
      rings: false,
      black: 226,
    })
    const found = findFace(image, faces)
    expect(found.black).toBeUndefined()
    expect(found.fits).toEqual([])
  })

  it('shows the ellipses and the ranking when a black area has no rings: the black diameter fits it', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const { image, h } = render({ ...scene(face, views[0]), rings: false })
    const found = findFace(image, faces)
    expect(found.fits).toEqual([])
    expect(found.black).toBeDefined()
    expect(found.ellipses).toHaveLength(1)
    expect(found.ranked.length).toBe(faces.filter((f) => f.photoSearch !== false).length)
    // the user types the black diameter: 200 mm
    const plane = fitDiameter(found, 200)
    expect(plane?.approximate).toBe(true)
    if (!plane) return
    const truth = project(h, { x: 0, y: 0 })
    expect(Math.hypot(plane.centre.x - truth.x, plane.centre.y - truth.y)).toBeLessThan(1.5)
    expect(plane.outer).toBe(100)
    const pxPerMm = (0.42 * Math.min(W, H)) / 250
    expect(Math.abs(plane.pxPerMm / pxPerMm - 1)).toBeLessThan(0.01)
    expect(fitDiameter(found, 0)).toBeUndefined()
    expect(
      fitDiameter({ ellipses: [], rings: [], ranked: [], fits: [], sure: false }, 200),
    ).toBeUndefined()
  })

  it('proposes no face for rings that are no face of the records', () => {
    // a black area with rings at 0.31, 0.58 and 0.83 of its radius, and 1.37, 1.9: no record
    const base = faceById('issf-25m-precision-50m-pistol')
    const odd: TargetFace = {
      ...base,
      id: 'odd',
      blackDiameter: { value: 200 },
      rings: [1.9, 1.37, 0.83, 0.58, 0.31].map((r, i) => ({
        value: i + 1,
        diameter: { value: 200 * r },
      })),
      innerTen: undefined,
    }
    const { image } = render(scene(odd, views[0]))
    const found = findFace(image, faces)
    expect(found.black).toBeDefined()
    expect(found.fits).toEqual([])
  })

  it('does not take a dark bar for the black area', () => {
    const data = new Uint8ClampedArray(W * H * 4).fill(232)
    // a 600 x 10 px bar: an ellipse in the fit, a face in no photo
    for (let y = 440; y < 450; y++)
      for (let x = 300; x < 900; x++) data.fill(34, (y * W + x) * 4, (y * W + x) * 4 + 3)
    const found = findFace({ width: W, height: H, data }, faces)
    expect(found.black).toBeUndefined()
    expect(found.fits).toEqual([])
  })

  it('does not take a coloured band for the black area', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const s = scene(face, views[0])
    const { image } = render(s)
    // the black area becomes red
    for (let i = 0; i < image.data.length; i += 4)
      if (image.data[i] < 80) [image.data[i], image.data[i + 1], image.data[i + 2]] = [200, 20, 40]
    const found = findFace(image, faces)
    expect(found.fits).toEqual([])
  })
})

describe('a face the user picks', () => {
  it('fits a face of the ranking from the rings found, and the black edge alone when they do not match', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const { image, h } = render(scene(face, views[1]))
    const found = findFace(image, faces)
    const own = fitPicked(found, face)
    expect(own?.approximate).toBe(false)
    expect(own?.ellipses).toBeGreaterThan(3)
    const other = fitPicked(found, faceById('issf-10m-air-pistol'))
    // the air pistol face does not match these rings: its black radius (29.75 mm) is the scale
    expect(other?.approximate).toBe(true)
    if (own) expect(error(own, h, 250).centre).toBeLessThan(2)
    expect(
      fitPicked({ ellipses: [], rings: [], ranked: [], fits: [], sure: false }, face),
    ).toBeUndefined()
  })

  it('drops a ring that matches a face ring by its radius and does not rectify to a circle', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const { image, h } = render(scene(face, views[1]))
    const found = findFace(image, faces)
    const fit = found.fits[0]
    expect(fit).toBeDefined()
    if (!fit) return
    // a ring of the right size whose centre is off by a tenth of its radius, with the most points
    const ring = found.rings[3]
    const r = meanRadius(ring.ellipse)
    const bogus = {
      ...ring,
      points: 1e6,
      ellipse: {
        ...ring.ellipse,
        centreX: ring.ellipse.centreX + 0.1 * r,
        centreY: ring.ellipse.centreY,
      },
    }
    const rings = [...found.rings.filter((x) => x !== ring), bogus]
    const picked = fitPicked({ ...found, rings }, face)
    expect(picked?.approximate).toBe(false)
    // the ring it replaced and the bogus one are both gone
    expect(picked?.ellipses).toBe(fit.ellipses - 1)
    if (picked) expect(error(picked, h, 250).centre).toBeLessThan(2)
  })

  // a face without ratio twins ranks first alone
  it.each(['issf-50m-rifle', 'issf-300m-rifle'])(
    'ranks %s and its ratio twins first, all others well below',
    (id) => {
      const face = faceById(id)
      const group = twinGroups.find((g) => g.includes(id)) ?? [id]
      const { image } = render(scene(face, views[0]))
      const found = findFace(image, faces)
      expect(
        found.ranked
          .slice(0, group.length)
          .map((r) => r.id)
          .sort(),
      ).toEqual([...group].sort())
      expect(found.ranked[0].score).toBeGreaterThan(found.ranked[group.length].score + 1)
      const own = found.ranked.find((r) => r.id === id)
      if (found.black)
        expect(matchFaces(found.black, found.rings, [face])[0].matched.length).toBe(own?.matched)
    },
  )

  it('lists as twins only faces whose ring ratios agree', () => {
    for (const group of twinGroups) {
      const ratios = group.map((id) => {
        const rings = faceById(id).rings
        return rings.map((r) => r.diameter.value / rings[0].diameter.value)
      })
      for (const r of ratios) {
        expect(r).toHaveLength(ratios[0].length)
        r.forEach((x, i) => {
          expect(x).toBeCloseTo(ratios[0][i], 2)
        })
      }
    }
  })
})

describe('on the photo and as a label', () => {
  it('maps a search from a resized crop back to the photo', () => {
    const face = faceById('issf-25m-rapid-fire-pistol')
    const { image } = render(scene(face, views[1]))
    const found = findFace(image, faces)
    const fit = found.fits[0]
    expect(fit && found.black).toBeTruthy()
    if (!(fit && found.black)) return
    // the crop is the photo from (100, 50) at half size
    const photo = onPhoto(found, 0.5, 100, 50)
    const p = photo.fits[0]
    expect(p.centre.x).toBeCloseTo(fit.centre.x * 2 + 100, 6)
    expect(p.centre.y).toBeCloseTo(fit.centre.y * 2 + 50, 6)
    expect(p.pxPerMm).toBeCloseTo(fit.pxPerMm * 2, 6)
    // a photo point and its crop point give the same face point
    const crop = { x: 300, y: 260 }
    const a = apply3(fit.toFace as number[], [crop.x, crop.y, 1])
    const b = apply3(p.toFace as number[], [crop.x * 2 + 100, crop.y * 2 + 50, 1])
    expect(b[0] / b[2]).toBeCloseTo(a[0] / a[2], 6)
    expect(b[1] / b[2]).toBeCloseTo(a[1] / a[2], 6)
    expect(photo.black && meanRadius(photo.black)).toBeCloseTo(meanRadius(found.black) * 2, 6)
    expect(
      onPhoto({ ellipses: [], rings: [], ranked: [], fits: [], sure: false }, 1, 0, 0).black,
    ).toBeUndefined()
  })

  it('labels the black area and outlines the face grown by half a hole', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const { image, h } = render(scene(face, views[1]))
    const fit = findFace(image, faces).fits[0]
    expect(fit).toBeDefined()
    if (!fit) return
    const label = faceLabel({ toFace: fit.toFace, outer: fit.outer, black: 100 }, 6)
    const at = (x: number, y: number) => project(h, { x, y })
    expect(label.black(at(0, 0))).toBe(true)
    expect(label.black(at(95, 0))).toBe(true)
    expect(label.black(at(105, 0))).toBe(false)
    expect(label.black(at(0, -180))).toBe(false)
    // every outline point is 253 mm from the centre
    for (const p of label.outline) {
      const q = apply3(fit.toFace as number[], [p.x, p.y, 1])
      expect(Math.hypot(q[0] / q[2], q[1] / q[2])).toBeCloseTo(253, 3)
    }
    // the matrix is invertible by the camera's own: the outline lies where the face is
    const inv = invert(h)
    const c = apply3(inv, [label.outline[0].x, label.outline[0].y, 1])
    expect(Math.hypot(c[0] / c[2], c[1] / c[2])).toBeGreaterThan(245)
  })

  it('marks where the ring numerals stand: on an axis, between two ring lines, inside the outer ring', () => {
    const face = faceById('issf-25m-precision-50m-pistol')
    const radii = face.rings.map((r) => r.diameter.value / 2)
    const { numeral } = faceLabel(
      { toFace: [1, 0, 0, 0, 1, 0, 0, 0, 1], outer: 250, black: 100, rings: radii },
      6,
    )
    expect(numeral).toBeDefined()
    if (!numeral) return
    const at = (x: number, y: number) => numeral({ x, y })
    // between the rings of 75 and 100 mm, on the horizontal axis and the vertical one
    expect(at(87.5, 0)).toBe(true)
    expect(at(-87.5, 3)).toBe(true)
    expect(at(0, -87.5)).toBe(true)
    // on the ring line, off the axes, inside the smallest ring, outside the outer ring
    expect(at(100, 0)).toBe(false)
    expect(at(87.5, 20)).toBe(false)
    expect(at(60, 60)).toBe(false)
    expect(at(10, 0)).toBe(false)
    expect(at(260, 0)).toBe(false)
    // without the rings there is no zone
    expect(
      faceLabel({ toFace: [1, 0, 0, 0, 1, 0, 0, 0, 1], outer: 250, black: 100 }, 6).numeral,
    ).toBeUndefined()
  })
})
