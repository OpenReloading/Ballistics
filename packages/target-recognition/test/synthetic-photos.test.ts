import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { labelSet } from '../src/label-set.ts'
import { defined } from './defined.ts'
import { writePhotos } from './fixtures/target-photos/make-synthetic.mts'
import { photoUniforms } from './fixtures/target-photos/synthetic.ts'

const options = {
  size: 128,
  diameter: [6, 30] as [number, number],
  holes: [2, 12] as [number, number],
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true })
})

function emptyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'synthetic-photos-'))
  dirs.push(dir)
  return dir
}

async function run(seed: number): Promise<string> {
  const dir = emptyDir()
  await writePhotos(dir, seed, 20, options)
  return dir
}

const hashes = (dir: string) =>
  Object.fromEntries(
    readdirSync(dir).map((f) => [
      f,
      createHash('sha256')
        .update(readFileSync(join(dir, f)))
        .digest('hex'),
    ]),
  )

const holes = (dir: string) =>
  Object.values(
    labelSet.parse(JSON.parse(readFileSync(join(dir, 'holes.json'), 'utf8'))).photos,
  ).map((p) => p.holes)

const draws = ([seed, index]: [number, number], n: number) =>
  Float64Array.from({ length: n }, photoUniforms(seed, index))

/** How many of the first 300 draws of photo `b` occur among the first 2^21 draws of photo `a`. */
function shared(a: [number, number], b: [number, number]): number {
  const stream = draws(a, 2 ** 21).toSorted()
  return draws(b, 300).filter((v) => {
    let [lo, hi] = [0, stream.length]
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (defined(stream[mid]) < v) lo = mid + 1
      else hi = mid
    }
    return stream[lo] === v
  }).length
}

describe('synthetic photo streams', () => {
  it('gives photos of nearby indices and seeds streams that share no draws', () => {
    // a 512 px photo draws about 1.6 million uniforms; on one 2^32 cycle the first two pairs overlap with starts at seed * 0x9e3779b1 + index, the third with starts at mix32(mix32(seed) + index * 0x9e3779b9)
    const pairs: [[number, number], [number, number]][] = [
      [
        [1, 0],
        [1, 797],
      ],
      [
        [1, 0],
        [2, 526],
      ],
      [
        [1, 3],
        [1, 30],
      ],
    ]
    for (const [a, b] of pairs) {
      expect(shared(a, b)).toBe(0)
      expect(shared(b, a)).toBe(0)
    }
  })
})

describe('synthetic photo publication', () => {
  it('removes the files it moved when a later move fails and keeps no temp folder', async () => {
    const parent = emptyDir()
    const target = join(parent, 'out')
    let calls = 0
    const move = (from: string, to: string) => {
      if (++calls === 2) throw new Error('disk gone')
      renameSync(from, to)
    }
    await expect(writePhotos(target, 7, 3, { ...options, move })).rejects.toThrow('disk gone')
    expect(readdirSync(target)).toEqual([])
    expect(readdirSync(parent)).toEqual(['out'])
  })

  it('stages beside the folder a symlinked target resolves to', async () => {
    const [realParent, linkParent] = [realpathSync(emptyDir()), emptyDir()]
    mkdirSync(join(realParent, 'real'))
    symlinkSync(join(realParent, 'real'), join(linkParent, 'link'))
    const stagedIn: string[] = []
    const move = (from: string, to: string) => {
      stagedIn.push(dirname(dirname(from)))
      renameSync(from, to)
    }
    await writePhotos(join(linkParent, 'link'), 7, 1, { ...options, move })
    expect(new Set(stagedIn)).toEqual(new Set([realParent]))
    expect(readdirSync(join(realParent, 'real'))).toHaveLength(2)
  })
})

describe('synthetic photos', () => {
  it('writes the same bytes for the same seed and other holes for another seed', async () => {
    const [a, b, c] = [await run(7), await run(7), await run(8)]
    expect(Object.keys(hashes(a))).toHaveLength(21)
    expect(hashes(b)).toEqual(hashes(a))
    expect(holes(c)).not.toEqual(holes(a))
  })

  it('rejects a seed outside 32 bits and leaves no folder', async () => {
    for (const seed of [2 ** 32, -1]) {
      const parent = emptyDir()
      await expect(writePhotos(join(parent, 'out'), seed, 1, options)).rejects.toThrow(/seed/)
      expect(readdirSync(parent)).toEqual([])
    }
  })

  it('leaves no folder when a later photo cannot fit its holes', async () => {
    const parent = emptyDir()
    const crowded = {
      size: 32,
      diameter: [20, 20] as [number, number],
      holes: [0, 30] as [number, number],
    }
    await expect(writePhotos(join(parent, 'out'), 7, 3, crowded)).rejects.toThrow(/^photo 2:/)
    expect(readdirSync(parent)).toEqual([])
  })

  it('writes a label set with every hole inside its photo and every diameter in the range', async () => {
    const set = labelSet.parse(JSON.parse(readFileSync(join(await run(3), 'holes.json'), 'utf8')))
    const photos = Object.values(set.photos)
    expect(photos).toHaveLength(20)
    for (const p of photos) {
      expect(p.size).toEqual([128, 128])
      expect(p.visibleDiameterPx).toBeGreaterThanOrEqual(6)
      expect(p.visibleDiameterPx).toBeLessThanOrEqual(30)
      for (const h of p.holes) {
        expect(h.x).toBeGreaterThanOrEqual(0)
        expect(h.x).toBeLessThanOrEqual(127)
        expect(h.y).toBeGreaterThanOrEqual(0)
        expect(h.y).toBeLessThanOrEqual(127)
      }
    }
  })
})
