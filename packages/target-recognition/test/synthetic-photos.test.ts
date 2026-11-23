import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { labelSet } from '../src/label-set.ts'
import { writePhotos } from './fixtures/target-photos/make-synthetic.mts'

const options = {
  size: 128,
  diameter: [6, 30] as [number, number],
  holes: [2, 12] as [number, number],
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true })
})

async function run(seed: number): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'synthetic-photos-'))
  dirs.push(dir)
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

describe('synthetic photos', () => {
  it('writes the same bytes for the same seed and other holes for another seed', async () => {
    const [a, b, c] = [await run(7), await run(7), await run(8)]
    expect(Object.keys(hashes(a))).toHaveLength(21)
    expect(hashes(b)).toEqual(hashes(a))
    expect(readFileSync(join(c, 'holes.json'), 'utf8')).not.toBe(
      readFileSync(join(a, 'holes.json'), 'utf8'),
    )
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
