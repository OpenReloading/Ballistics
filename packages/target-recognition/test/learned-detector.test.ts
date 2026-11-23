import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { HoleProposal } from '../src/hole-detection.ts'
import { matchHoles } from '../src/hole-matching.ts'
import {
  learnedDetector,
  ModelContractError,
  type ModelTensor,
  type RunModel,
} from '../src/learned-detector.ts'
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

describe('learnedDetector model input', () => {
  // 6 x 4 px, R = 10 + 10x + 60y, G = 100 + 3x + 20y, B = 250 - 10x - 60y: at scale 0.5 working px (u, v) is the mean of photo px 2u..2u+1, 2v..2v+1
  const pattern = {
    width: 6,
    height: 4,
    data: new Uint8ClampedArray(
      Array.from({ length: 24 }, (_, i) => {
        const [x, y] = [i % 6, Math.floor(i / 6)]
        return [10 + 10 * x + 60 * y, 100 + 3 * x + 20 * y, 250 - 10 * x - 60 * y, 255]
      }).flat(),
    ),
  }

  it('averages the covered photo area, pads with the edge px and orders and scales the channels as the manifest gives', async () => {
    const seen: ModelTensor[] = []
    const keep: RunModel = async (input) => {
      seen.push(input)
      return { data: new Float32Array(8 * 8), dims: [1, 1, 8, 8] }
    }
    // the range maps px value 0 to 255 onto -1 to 1.55, so a value reads as -1 + value / 100
    const bgr: ModelManifest = {
      ...manifest,
      input: { ...manifest.input, channels: 'bgr', range: [-1, 1.55] },
    }
    await learnedDetector(bgr, keep).propose({ ...request, image: pattern })
    const [input] = seen
    expect(input?.dims).toEqual([1, 3, 16, 16])
    const at = (u: number, v: number) => [
      u,
      v,
      ...[0, 1, 2].map((c) => Math.round((input?.data[(c * 16 + v) * 16 + u] ?? NaN) * 1e5) / 1e5),
    ]
    // [u, v, B, G, R] of the 3 x 2 working image padded to 16 x 16; the last three are padding
    expect([at(0, 0), at(1, 1), at(9, 0), at(1, 7), at(15, 15)]).toEqual([
      [0, 0, 1.15, 0.115, -0.55],
      [1, 1, -0.25, 0.575, 0.85],
      [9, 0, 0.75, 0.235, -0.15],
      [1, 7, -0.25, 0.575, 0.85],
      [15, 15, -0.45, 0.635, 1.05],
    ])
  })

  it('maps a peak back to photo px at the rounded working size', async () => {
    // 101 x 69 px at scale 0.5: working image 51 x 35 (not 50.5 x 34.5), so cell (25, 17) lies at the working image's far corner
    const found = await propose([[25, 17, 0.9]], {
      image: { width: 101, height: 69, data: new Uint8ClampedArray(101 * 69 * 4).fill(128) },
    })
    expect(found.map(({ x, y }) => ({ x, y }))).toEqual([{ x: 100.5, y: 68.5 }])
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

// a 16 px hole is the manifest's working hole, so the photo is the working image; heatmap cells lie 2 px apart
const bigImage = (width: number, height: number) => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4).fill(128),
})
const bigRequest = { pxPerM: 1000, expectedHoleDiameter: 0.016 }

/** A model that returns a heatmap of (width / 2) x (padded height / 2) cells with the given cells set. */
const bigStub =
  (cells: [x: number, y: number][]): RunModel =>
  async (input) => {
    const [, , ph, pw] = input.dims
    const [gw, gh] = [Number(pw) / 2, Number(ph) / 2]
    const data = new Float32Array(gw * gh)
    for (const [x, y] of cells) data[y * gw + x] = 0.9
    return { data, dims: [1, 1, gh, gw] }
  }

/** mulberry32: a deterministic stream of floats in [0, 1) */
const seeded = (start: number) => {
  let seed = start
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('learnedDetector clustering at scale', () => {
  it('gives the cluster ids of the pairwise comparison of every two peaks', async () => {
    const next = seeded(20_260_101)
    const cells: [number, number][] = []
    for (let i = 0; i < 1500; i++) cells.push([Math.floor(next() * 400), Math.floor(next() * 299)])
    const { proposals } = await learnedDetector(manifest, bigStub(cells)).propose({
      ...bigRequest,
      image: bigImage(800, 600),
    })

    // reference: the union of every pair closer than the 16 px hole, ids by the first peak of each cluster
    const root = proposals.map((_, i) => i)
    const find = (i: number): number => (root[i] === i ? i : find(root[i] ?? i))
    for (const [i, a] of proposals.entries())
      for (const [j, b] of proposals.entries())
        if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < 16) root[find(j)] = find(i)
    const ids = new Map<number, number>()
    const expected = proposals.map((_, i) => {
      const id = ids.get(find(i)) ?? ids.size
      ids.set(find(i), id)
      return id
    })

    expect(proposals.map((p) => p.clusterId)).toEqual(expected)
    // the random set holds singletons, pairs and longer chains
    expect(Math.max(...expected)).toBeGreaterThan(100)
    expect(Math.max(...proposals.map((p) => p.clusterSize))).toBeGreaterThan(3)
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
