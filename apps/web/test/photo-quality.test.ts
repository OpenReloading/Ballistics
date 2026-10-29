import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { msg } from '../src/i18n/translate.ts'
import { findFace } from '../src/lib/face-search.ts'
import type { RgbaImage } from '../src/lib/image.ts'
import {
  belowMinimum,
  layoutOf,
  photoQuality,
  type QualityIssue,
  type TargetLayout,
} from '../src/lib/photo-quality.ts'
import { photoScene } from './face-photos.ts'
import { faceById, faces, render, type Scene } from './face-render.ts'

// Photo quality on drawn photos: a clean photo of a face has no problem, and each degradation
// (blur, low light, a reflection, a shadow, a slant, a small target, a cut black area) is named.

const pistol = 'issf-25m-precision-50m-pistol'
const base = (id = pistol, kind: 'whole' | 'insert' = 'whole', bullet = 9) =>
  photoScene(faceById(id), kind, bullet)

/** The face search as the editor runs it, then the quality check at the scale of the drawn photo. */
function check(scene: Scene, bullet = 9, scale = 1): QualityIssue[] {
  const { image } = render(scene)
  const search = findFace(image, faces)
  const [fit] = search.fits
  return photoQuality({
    image,
    scale,
    black: search.black,
    holePx: fit && fit.pxPerMm * bullet,
  })
}

const problems = (issues: readonly QualityIssue[]) => issues.map((i) => i.problem)
const level = (issues: readonly QualityIssue[], problem: string) =>
  issues.find((i) => i.problem === problem)?.level

describe('a clean photo', () => {
  for (const [id, bullet] of [
    [pistol, 9],
    ['issf-10m-air-rifle', 4.5],
    ['bdmp-nr1-100m', 7.62],
  ] as const)
    it(`of ${id} has no problem`, () => {
      expect(check(base(id, 'whole', bullet), bullet)).toEqual([])
    })

  it('of an insert card has no problem', () => {
    expect(check(base(pistol, 'insert'))).toEqual([])
  })
})

describe('a degraded photo', () => {
  it('that is out of focus is blurred', () => {
    expect(level(check({ ...base(), blur: 4 }), 'blur')).toBe('bad')
  })

  it('with grain alone is not blurred', () => {
    expect(problems(check({ ...base(), noise: 20 }))).not.toContain('blur')
  })

  it('in dim light has little contrast', () => {
    const issues = check({ ...base(), light: () => 0.2 })
    expect(level(issues, 'contrast')).toBe('bad')
    expect(belowMinimum(issues)).toBe(true)
  })

  it('with a reflection on the paper has glare', () => {
    const scene = {
      ...base(),
      light: (x: number, y: number) => (Math.hypot(x - 700, y - 450) < 160 ? 2.6 : 1),
    }
    expect(level(check(scene), 'glare')).toBe('bad')
  })

  it('with a shadow over one side has uneven light', () => {
    expect(level(check({ ...base(), light: (x: number) => (x < 600 ? 0.45 : 1) }), 'shadow')).toBe(
      'bad',
    )
  })

  it('taken at a steep slant is tilted', () => {
    const scene = base()
    expect(level(check({ ...scene, camera: { ...scene.camera, tilt: 65 } }), 'tilt')).toBe('bad')
  })

  it('with the target far away has too few pixels per hole', () => {
    const scene = base()
    const k = 0.25
    const { camera } = scene
    const small = {
      ...scene,
      camera: {
        ...camera,
        width: camera.width * k,
        height: camera.height * k,
        pxPerMm: camera.pxPerMm * k,
        at: camera.at && { x: camera.at.x * k, y: camera.at.y * k },
      },
    }
    expect(problems(check(small))).toContain('resolution')
  })

  it('with the black area cut by the edge is badly framed', () => {
    const scene = base()
    const at = { x: scene.camera.width * 0.97, y: scene.camera.height / 2 }
    expect(problems(check({ ...scene, camera: { ...scene.camera, at } }))).toContain('framing')
  })

  it('names the problem and what to change, without a verdict on detection', () => {
    for (const i of check({ ...base(), blur: 4, light: () => 0.2 })) {
      expect(i.text.length).toBeGreaterThan(20)
      expect(i.fix).toMatch(/^(Retake|Move|Hold|Use)/)
      expect(`${i.text} ${i.fix}`).not.toMatch(/\b(safe|correct|accurate|good)\b/i)
    }
  })
})

describe('a photo without a black area', () => {
  const flat = (width: number, height: number, grey: number): RgbaImage => ({
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4).fill(grey),
  })

  it('of one grey shows no edge of a target or a hole, below the minimum quality', () => {
    const issues = photoQuality({ image: flat(900, 700, 128), scale: 1 })
    expect(level(issues, 'face')).toBe('bad')
    expect(belowMinimum(issues)).toBe(true)
  })

  it('that is dark is a note, not a hold, while it may be a black target', () => {
    const issues = photoQuality({ image: flat(900, 700, 40), scale: 1 })
    expect(level(issues, 'exposure')).toBe('fair')
  })

  it('is judged on glare over the whole photo', () => {
    const image = flat(900, 700, 200)
    for (let y = 0; y < 700; y++)
      for (let x = 0; x < 180; x++) image.data.set([255, 255, 255, 255], (y * 900 + x) * 4)
    expect(level(photoQuality({ image, scale: 1 }), 'glare')).toBe('bad')
  })

  it('is judged on its size', () => {
    const issues = photoQuality({ image: flat(200, 150, 128), scale: 1 })
    expect(level(issues, 'resolution')).toBe('bad')
  })

  it('shows no framing, tilt or uneven light', () => {
    const issues = photoQuality({ image: flat(1600, 1200, 128), scale: 1 })
    for (const problem of ['framing', 'tilt', 'shadow'])
      expect(problems(issues)).not.toContain(problem)
  })
})

describe('the edge of the black area', () => {
  /** A dark disc of radius 100 px on paper, edge blurred by a ramp of `ramp` px. */
  function disc(ramp: number): RgbaImage {
    const size = 500
    const data = new Uint8ClampedArray(size * size * 4)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const t = Math.min(1, Math.max(0, (Math.hypot(x - 250, y - 250) - 100) / ramp + 0.5))
        data.set([30 + 190 * t, 30 + 190 * t, 30 + 190 * t, 255], (y * size + x) * 4)
      }
    return { width: size, height: size, data }
  }
  const at = (r: number, dx = 0) => ({
    centreX: 250 + dx,
    centreY: 250,
    semiMajor: r,
    semiMinor: r,
    angle: 0,
  })

  it('is measured when the ellipse is off by a few px', () => {
    const issues = photoQuality({ image: disc(1.5), scale: 1, black: at(106, 4), holePx: 20 })
    expect(problems(issues)).not.toContain('blur')
  })

  it('shows a soft edge off the same ellipse', () => {
    const issues = photoQuality({ image: disc(24), scale: 1, black: at(106, 4), holePx: 20 })
    expect(level(issues, 'blur')).toBe('bad')
  })
})

describe('belowMinimum', () => {
  it('holds only for a problem at the bad level', () => {
    const issue = { problem: 'tilt', text: msg(''), fix: msg('') } as const
    expect(belowMinimum([])).toBe(false)
    expect(belowMinimum([{ ...issue, level: 'fair' }])).toBe(false)
    expect(
      belowMinimum([
        { ...issue, level: 'fair' },
        { ...issue, level: 'bad' },
      ]),
    ).toBe(true)
  })
})

describe('a target of any pattern', () => {
  const [W, H, C] = [1200, 900, { x: 600, y: 450 }]
  type Zone = { r: number; grey: number }
  type Line = { r: number; w: number; grey: number }
  type Pattern = {
    zones: Zone[]
    lines: Line[]
    holes: Array<{ x: number; y: number; grey: number }>
  }

  const edge = (d: number) => Math.min(1, Math.max(0, 0.5 + d / 1.5))
  /** The grey of the pattern at (px, py) units, `zoom` px per unit, over paper of 226. */
  function greyAt(p: Pattern, px: number, py: number, zoom: number): number {
    const r = Math.hypot(px, py)
    let v = 226
    for (const z of p.zones) v += (z.grey - v) * edge((z.r - r) * zoom)
    for (const l of p.lines) v += (l.grey - v) * edge((l.w / 2 - Math.abs(r - l.r)) * zoom)
    for (const h of p.holes) v += (h.grey - v) * edge((9 - Math.hypot(px - h.x, py - h.y)) * zoom)
    return v
  }
  /** The pattern drawn at `zoom` px per unit about `at`; `light` scales every grey. */
  function draw(p: Pattern, { zoom = 1, at = C, light = 1 } = {}): RgbaImage {
    const data = new Uint8ClampedArray(W * H * 4)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const v = greyAt(p, (x - at.x) / zoom, (y - at.y) / zoom, zoom) * light
        data.set([v, v, v, 255], (y * W + x) * 4)
      }
    return { width: W, height: H, data }
  }
  const soft = async (image: RgbaImage, sigma: number): Promise<RgbaImage> => {
    const raw = { width: W, height: H, channels: 4 as const }
    const out = await sharp(Buffer.from(image.data), { raw }).blur(sigma).raw().toBuffer()
    return { width: W, height: H, data: new Uint8ClampedArray(out) }
  }

  const holes = (grey: number) =>
    [
      [60, 40],
      [-90, 70],
      [110, -80],
      [-40, -120],
    ].map(([x = 0, y = 0]) => ({ x, y, grey }))
  const rings = (grey: number, ...radii: number[]) => radii.map((r) => ({ r, w: 3, grey }))
  type Target = Pattern & { black?: number | undefined; dark: boolean }
  const patterns = {
    'all black circles': {
      zones: [{ r: 300, grey: 30 }],
      lines: rings(190, 100, 200),
      holes: holes(120),
      black: 300,
      dark: true,
    },
    'a white target with thin rings': {
      zones: [],
      lines: rings(40, 60, 120, 180, 240, 300),
      holes: holes(80),
      dark: false,
    },
    'a plain white sheet with a few holes': { zones: [], lines: [], holes: holes(80), dark: false },
    'a mix of black and white zones': {
      zones: [
        { r: 300, grey: 30 },
        { r: 200, grey: 226 },
        { r: 100, grey: 30 },
      ],
      lines: rings(190, 250),
      holes: holes(120),
      black: 300,
      dark: true,
    },
  } satisfies Record<string, Target>
  const view = (
    p: Target,
    image: RgbaImage,
    layout?: TargetLayout,
  ): Parameters<typeof photoQuality>[0] => ({
    image,
    scale: 1,
    holePx: 18,
    layout,
    black:
      p.black === undefined
        ? undefined
        : {
            centreX: C.x,
            centreY: C.y,
            semiMajor: p.black,
            semiMinor: p.black,
            angle: 0,
          },
  })

  for (const [name, p] of Object.entries<Target>(patterns))
    describe(name, () => {
      for (const layout of [undefined, { dark: p.dark }, { dark: undefined }])
        it(`gives no warning when sharp and lit (layout ${JSON.stringify(layout)})`, () => {
          expect(photoQuality(view(p, draw(p), layout))).toEqual([])
        })

      it('is still caught when out of focus', async () => {
        expect(problems(photoQuality(view(p, await soft(draw(p), 6))))).toContain('blur')
      })

      it('is still caught when underexposed', () => {
        const issues = photoQuality(view(p, draw(p, { light: 0.2 })))
        expect(problems(issues)).toContain(p.black ? 'contrast' : 'exposure')
      })
    })

  it('expects no black zone of a selected white target: a dark photo is a hold', () => {
    const p = patterns['a plain white sheet with a few holes']
    const dark = draw(p, { light: 0.2 })
    expect(level(photoQuality(view(p, dark)), 'exposure')).toBe('fair')
    expect(level(photoQuality(view(p, dark, { dark: false })), 'exposure')).toBe('bad')
  })

  it('expects black zones of a selected black target: a photo filled by them is not dark', () => {
    // the centre of an all black target: no paper in the frame, the black not found as an area
    const p = patterns['all black circles']
    const centre = draw({ ...p, zones: [{ r: 3000, grey: 30 }], lines: rings(190, 120, 260) })
    const view0 = { image: centre, scale: 1, holePx: 18 }
    expect(level(photoQuality(view0), 'exposure')).toBe('fair')
    expect(photoQuality({ ...view0, layout: { dark: true } })).toEqual([])
    const washed = draw({ ...p, zones: [{ r: 3000, grey: 165 }], lines: [] })
    expect(
      level(photoQuality({ ...view0, image: washed, layout: { dark: true } }), 'contrast'),
    ).toBe('bad')
  })

  describe('with a selected target of unknown extent', () => {
    const layout = { dark: true }
    const mix = patterns['a mix of black and white zones']
    const rimmed = { ...mix, black: undefined }

    it('shows only its centre (a zoomed photo with the black area cut by the frame)', () => {
      const image = draw(mix, { zoom: 2 })
      const cut = {
        ...view(mix, image, layout),
        black: view(mix, image).black && {
          centreX: C.x,
          centreY: C.y,
          semiMajor: 600,
          semiMinor: 600,
          angle: 0,
        },
      }
      expect(photoQuality(cut)).toEqual([])
    })

    it('is cropped through its rings', () => {
      const image = draw(mix, { at: { x: 1000, y: 450 } })
      const crop = {
        ...view(mix, image, layout),
        black: { centreX: 1000, centreY: 450, semiMajor: 300, semiMinor: 300, angle: 0 },
      }
      expect(photoQuality(crop)).toEqual([])
      const white = patterns['a white target with thin rings']
      expect(
        photoQuality(view(white, draw(white, { at: { x: 1000, y: 700 } }), { dark: false })),
      ).toEqual([])
      expect(photoQuality(view(rimmed, draw(mix), layout))).toEqual([])
    })

    it('is the whole sheet with a small black area', () => {
      const image = draw(mix, { zoom: 0.5 })
      const full = {
        ...view(mix, image, layout),
        black: { centreX: C.x, centreY: C.y, semiMajor: 150, semiMinor: 150, angle: 0 },
        holePx: 9,
      }
      expect(photoQuality(full)).toEqual([])
    })
  })

  it('reads the zone colours of a face record, or none', () => {
    const ring = (fill?: 'black' | 'white') => ({
      value: 1,
      diameter: { value: 1, unit: 'mm' as const },
      ...(fill && { fill }),
    })
    expect(layoutOf({ rings: [ring('white'), ring('black')] } as never)).toEqual({ dark: true })
    expect(layoutOf({ rings: [ring('white'), ring('white')] } as never)).toEqual({ dark: false })
    expect(layoutOf({ rings: [ring(), ring('white')] } as never)).toEqual({ dark: undefined })
  })
})
