/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { autoDetect, detectFromExample, type HoleProposal } from '../src/lib/hole-detection.ts'
import { isMaybe } from '../src/lib/hole-proposals.ts'
import type { RgbaImage } from '../src/lib/image.ts'

// Recall on the committed synthetic photos (test/fixtures/target-photos, made by make.mts):
// scanned and phone photos of light and dark faces whose holes show 0.7 to 0.8 of the bullet.
const dir = join(import.meta.dirname, 'fixtures', 'target-photos')
type Fixture = {
  size: [number, number]
  pxPerMm: number
  caliberMm: number
  visibleDiameterPx: number
  holes: { x: number; y: number }[]
}
const fixtures = Object.entries(
  JSON.parse(readFileSync(join(dir, 'holes.json'), 'utf8')).photos as Record<string, Fixture>,
)

async function load(file: string): Promise<RgbaImage> {
  const { data, info } = await sharp(join(dir, file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  }
}

/** Marked holes matched one to one to the nearest proposal within half a hole. */
function score(found: readonly HoleProposal[], f: Fixture) {
  const pairs = f.holes
    .flatMap((h, i) => found.map((p, j) => ({ i, j, d: Math.hypot(p.x - h.x, p.y - h.y) })))
    .filter((q) => q.d <= f.visibleDiameterPx / 2)
    .sort((a, b) => a.d - b.d)
  const [holes, props] = [new Set<number>(), new Set<number>()]
  for (const q of pairs) {
    if (holes.has(q.i) || props.has(q.j)) continue
    holes.add(q.i)
    props.add(q.j)
  }
  return { recall: holes.size / f.holes.length, false: found.length - props.size }
}

/** The proposals at or above the confidence tier lose no hole and add no false proposal. */
function expectTierKeeps(found: readonly HoleProposal[], f: Fixture) {
  const all = score(found, f)
  const sure = score(
    found.filter((p) => !isMaybe(p)),
    f,
  )
  expect(sure.recall).toBe(all.recall)
  expect(sure.false).toBeLessThanOrEqual(all.false)
}

describe('hole detection on the fixture photos', () => {
  // the result must not depend on the hole the user picks, and no region is marked (the
  // module finds the target)
  for (const [file, f] of fixtures)
    it(`finds the holes of ${file} whichever hole is the example`, async () => {
      const image = await load(file)
      const pxPerM = f.pxPerMm * 1000
      for (const at of f.holes) {
        const found = detectFromExample(
          { image, pxPerM, expectedHoleDiameter: f.caliberMm / 1000 },
          at,
        )
        expect(found).toBeDefined()
        if (!found) return
        expect(Math.abs(found.holeDiameter / (f.visibleDiameterPx / pxPerM) - 1)).toBeLessThan(0.25)
        const s = score(found.proposals, f)
        expect(s.recall).toBeGreaterThanOrEqual(0.8)
        // a black centre of about 2.7 holes across reads as a cluster of holes (scan-light.jpg, phone-light.jpg)
        expect(s.false).toBeLessThanOrEqual(7)
        expectTierKeeps(found.proposals, f)
      }
    })

  // auto detection without a picked hole, on light and dark faces
  for (const [file, f] of fixtures)
    it(`auto detection finds the holes of ${file}`, async () => {
      const found = autoDetect({
        image: await load(file),
        pxPerM: f.pxPerMm * 1000,
        expectedHoleDiameter: f.caliberMm / 1000,
      })
      expect(found).toBeDefined()
      if (!found) return
      const s = score(found.proposals, f)
      expect(s.recall).toBeGreaterThanOrEqual(0.8)
      expect(s.false).toBeLessThanOrEqual(7)
      expectTierKeeps(found.proposals, f)
      expect(
        Math.abs(found.holeDiameter / (f.visibleDiameterPx / (f.pxPerMm * 1000)) - 1),
      ).toBeLessThan(0.25)
    })
})

// A dark face with holes as dark as their backing (phone-night.jpg): the strongest light blobs of
// the grain agree with each other, so the run that wins must not be theirs.
describe('hole detection on a dark face with dark holes', () => {
  const fixture = fixtures.find(([file]) => file === 'phone-night.jpg')

  it('finds at least 8 of the 10 holes in the automatic run, with no false proposal', async () => {
    const [file, f] = fixture ?? []
    expect(file && f).toBeTruthy()
    if (!(file && f)) return
    expect(f.holes).toHaveLength(10)
    const found = autoDetect({
      image: await load(file),
      pxPerM: f.pxPerMm * 1000,
      expectedHoleDiameter: f.caliberMm / 1000,
    })
    const s = score(found?.proposals ?? [], f)
    expect(s.recall).toBeGreaterThanOrEqual(0.8)
    expect(s.false).toBe(0)
  })
})
