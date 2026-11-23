import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { HoleProposal } from '../src/hole-detection.ts'
import { matchHoles } from '../src/hole-matching.ts'
import { learnedDetector, ModelContractError, type RunModel } from '../src/learned-detector.ts'
import { type ModelManifest, modelManifest } from '../src/model-manifest.ts'

// threshold 0.35, sure 0.6, working hole 16 px, size multiple 16, stride 2
const manifest = modelManifest.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'model-manifest.json'), 'utf8')),
)
const withOutput = (output: Partial<ModelManifest['output']>): ModelManifest => ({
  ...manifest,
  output: { ...manifest.output, ...output },
})

// 100 x 70 px with a 32 px hole: working image 50 x 35, padded to 64 x 48, heatmap 32 x 24; cell (x, y) lies at 4x + 1.5, 4y + 1.5 photo px
const image = { width: 100, height: 70, data: new Uint8ClampedArray(100 * 70 * 4).fill(128) }
const request = { image, pxPerM: 1000, expectedHoleDiameter: 0.032 }

/** A model that checks the padded input size and returns a 32 x 24 heatmap with the given cells set. */
const stub =
  (cells: [x: number, y: number, value: number][]): RunModel =>
  async (input) => {
    expect(input.dims).toEqual([1, 3, 48, 64])
    const data = new Float32Array(32 * 24)
    for (const [x, y, value] of cells) data[y * 32 + x] = value
    return { data, dims: [1, 1, 24, 32] }
  }

const propose = async (cells: [number, number, number][], extra: object = {}) =>
  (await learnedDetector(manifest, stub(cells)).propose({ ...request, ...extra })).proposals

const halfSize: RunModel = async () => ({ data: new Float32Array(16 * 12), dims: [1, 1, 12, 16] })

// the web app's maybe tier: a confidence below 0.5 (apps/docs/docs/models/hole-detection.md)
const tier = (p: HoleProposal) => (p.confidence < 0.5 ? 'maybe' : 'sure')

describe('learnedDetector peak decoding', () => {
  it('maps three peaks back to photo px through the resize and the padding', async () => {
    const found = await propose([
      [3, 4, 0.9],
      [10, 15, 0.9],
      [20, 2, 0.9],
    ])
    expect(found.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 81.5, y: 9.5 },
      { x: 13.5, y: 17.5 },
      { x: 41.5, y: 61.5 },
    ])
  })

  it('drops a peak whose cell lies in the padding', async () => {
    expect(await propose([[26, 5, 0.9]])).toEqual([])
  })

  it('keeps a peak at the threshold and drops one below it', async () => {
    const found = await propose([
      [3, 4, 0.35],
      [20, 2, 0.3499],
    ])
    expect(found.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 13.5, y: 17.5 }])
  })
})

describe('learnedDetector clusters and tiers', () => {
  it('clusters peaks closer than one hole diameter and splits peaks farther apart', async () => {
    // 28 px apart, then 36 px apart, for a 32 px hole
    const found = await propose([
      [5, 5, 0.9],
      [12, 5, 0.9],
      [5, 15, 0.9],
      [14, 15, 0.9],
    ])
    expect(
      found.map(({ x, y, clusterId, clusterSize }) => ({ x, y, clusterId, clusterSize })),
    ).toEqual([
      { x: 21.5, y: 21.5, clusterId: 0, clusterSize: 2 },
      { x: 49.5, y: 21.5, clusterId: 0, clusterSize: 2 },
      { x: 21.5, y: 61.5, clusterId: 1, clusterSize: 1 },
      { x: 57.5, y: 61.5, clusterId: 2, clusterSize: 1 },
    ])
  })

  it.each([
    [0.35, 'maybe'],
    [0.5999, 'maybe'],
    [0.6, 'sure'],
  ])('maps a peak of %f onto the %s tier', async (value, expected) => {
    const [found] = await propose([[3, 4, value]])
    expect(found && tier(found)).toBe(expected)
  })
})

describe('learnedDetector region and contract', () => {
  it('keeps the proposals inside the region', async () => {
    const found = await propose(
      [
        [3, 4, 0.9],
        [10, 15, 0.9],
        [20, 2, 0.9],
      ],
      { region: { x: 0, y: 0, width: 50, height: 70 } },
    )
    expect(found.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 13.5, y: 17.5 },
      { x: 41.5, y: 61.5 },
    ])
  })

  it.each([
    ['a stride that does not divide the size multiple', { stride: 3 }],
    ['a second output channel', { channels: 2 }],
  ])('rejects a manifest with %s', (_, output) => {
    expect(() => learnedDetector(withOutput(output), stub([]))).toThrow(ModelContractError)
  })

  it('rejects a heatmap of another size than the manifest gives', async () => {
    await expect(learnedDetector(manifest, halfSize).propose(request)).rejects.toThrow(
      ModelContractError,
    )
  })

  it('rejects holes so small that the working image passes 2 million px', async () => {
    await expect(propose([], { expectedHoleDiameter: 0.0005 })).rejects.toThrow(RangeError)
  })
})

describe('learnedDetector on the fixture photos', () => {
  const dir = join(import.meta.dirname, 'fixtures', 'target-photos')
  type Fixture = { pxPerMm: number; visibleDiameterPx: number; holes: { x: number; y: number }[] }
  const fixtures = Object.entries(
    JSON.parse(readFileSync(join(dir, 'holes.json'), 'utf8')).photos as Record<string, Fixture>,
  )

  /** A model that knows the holes: a Gaussian of one cell around each hole's heatmap position, 0.9 at its center. */
  const knowing =
    (f: Fixture): RunModel =>
    async ({ dims: [, , height = 0, width = 0] }) => {
      const [gw, gh] = [width / 2, height / 2]
      const s = 16 / f.visibleDiameterPx
      const data = new Float32Array(gw * gh)
      for (const hole of f.holes) {
        const [cx, cy] = [((hole.x + 0.5) * s) / 2 - 0.5, ((hole.y + 0.5) * s) / 2 - 0.5]
        for (let y = 0; y < gh; y++)
          for (let x = 0; x < gw; x++) {
            const v = 0.9 * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / 2)
            data[y * gw + x] = Math.max(data[y * gw + x] ?? 0, v)
          }
      }
      return { data, dims: [1, 1, gh, gw] }
    }

  for (const [file, f] of fixtures)
    it(`finds each hole of ${file} once at the sure tier, with no false proposal`, async () => {
      const { data, info } = await sharp(join(dir, file))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const photo = {
        width: info.width,
        height: info.height,
        data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
      }
      const pxPerM = f.pxPerMm * 1000
      const { proposals } = await learnedDetector(manifest, knowing(f)).propose({
        image: photo,
        pxPerM,
        expectedHoleDiameter: f.visibleDiameterPx / pxPerM,
      })
      const sure = proposals.filter((p) => tier(p) === 'sure')
      const m = matchHoles(sure, f.holes, f.visibleDiameterPx)
      expect({ proposals: proposals.length, matched: m.matched, false: m.false }).toEqual({
        proposals: f.holes.length,
        matched: f.holes.length,
        false: 0,
      })
    })
})
