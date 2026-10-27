import { describe, expect, it } from 'vitest'
import type { RgbaImage } from '../src/lib/image.ts'
import { belowMinimum, photoQuality, type QualityIssue } from '../src/lib/photo-quality.ts'
import { findFace } from '../src/lib/target-face.ts'
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

  it('of one grey has no contrast', () => {
    expect(level(photoQuality({ image: flat(900, 700, 128), scale: 1 }), 'contrast')).toBe('bad')
  })

  it('is reported as such, below the minimum quality', () => {
    const issues = photoQuality({ image: flat(900, 700, 128), scale: 1 })
    expect(level(issues, 'face')).toBe('bad')
    expect(belowMinimum(issues)).toBe(true)
  })

  it('is judged on its size', () => {
    const issues = photoQuality({ image: flat(200, 150, 128), scale: 1 })
    expect(level(issues, 'resolution')).toBe('bad')
  })

  it('shows no framing, tilt or uneven light', () => {
    const issues = photoQuality({ image: flat(1600, 1200, 128), scale: 1 })
    expect(problems(issues)).not.toEqual(expect.arrayContaining(['framing', 'tilt', 'shadow']))
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
    const issue = { problem: 'tilt', text: '', fix: '' } as const
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
