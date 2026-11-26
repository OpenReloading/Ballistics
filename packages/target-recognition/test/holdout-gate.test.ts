import { createHash } from 'node:crypto'
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { freeze, type GatePaths, gate } from '../scripts/holdout-gate.mts'
import type { InferencePort } from '../src/inference-port.ts'
import { type LabeledPhoto, labelSet } from '../src/label-set.ts'
import { writePhotos } from './fixtures/target-photos/make-synthetic.mts'

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true })
})

/** Three generated photos, a hand-written label set of them and its freeze file in a new folder. */
async function frozenFolder(): Promise<
  GatePaths & { names: [string, string, string]; hashes: string[] }
> {
  const dir = mkdtempSync(join(tmpdir(), 'holdout-gate-'))
  dirs.push(dir)
  const photos = join(dir, 'photos')
  await writePhotos(photos, 7, 3, { size: 64, diameter: [8, 12], holes: [0, 3] })
  const made = labelSet.parse(JSON.parse(readFileSync(join(photos, 'holes.json'), 'utf8')))
  const [a, b, c] = Object.entries(made.photos)
  if (!a || !b || !c) throw new Error('three photos expected')
  const label = (photo: LabeledPhoto, facts: Partial<LabeledPhoto>): LabeledPhoto => ({
    ...photo,
    source: 'own photo',
    author: 'Test Labeler',
    usable: true,
    complete: true,
    visibleDiameterPx: 10,
    ...facts,
  })
  const labels = join(dir, 'labels.json')
  const set = {
    photos: {
      [a[0]]: label(a[1], {
        kind: 'printed',
        holes: [
          { x: 10, y: 10, uncertain: false },
          { x: 40, y: 40, uncertain: true },
        ],
      }),
      [b[0]]: label(b[1], { kind: 'grid', holes: [{ x: 20, y: 20, uncertain: false }] }),
      [c[0]]: label(c[1], { kind: 'printed', usable: false, holes: [] }),
    },
  }
  writeFileSync(labels, JSON.stringify(set))
  const paths = { photos, labels, freeze: join(dir, 'freeze.json') }
  freeze(paths)
  const hashes = [a, b, c].map(([, p]) => p.sha256)
  hashes.push(createHash('sha256').update(readFileSync(labels)).digest('hex'))
  return { ...paths, names: [a[0], b[0], c[0]], hashes }
}

/** A port that answers its calls, in order, with the given proposals. */
function scripted(calls: [x: number, y: number, confidence: number][][]): InferencePort {
  let call = 0
  return {
    propose: async () => ({
      proposals: (calls[call++] ?? []).map(([x, y, confidence]) => ({
        x,
        y,
        confidence,
        clusterSize: 1,
        clusterId: 0,
        diameter: 10,
      })),
      flagged: [],
    }),
  }
}

// near the first hole, a maybe on the second, one far off; none on the second photo: 1 and 1 corrections
const near = () =>
  scripted([
    [
      [11, 10, 0.9],
      [40, 40, 0.3],
      [60, 5, 0.6],
    ],
    [],
  ])
// five sure proposals far from every hole on both photos: 5 and 5 corrections
const far = () => {
  const off: [number, number, number][] = [50, 52, 54, 56, 58].map((x) => [x, 60, 0.8])
  return scripted([off, off])
}

describe('holdout gate', () => {
  it('prints the aggregates of each detector against the default bar and counts each look', async () => {
    const folder = await frozenFolder()
    const first = await gate(folder, { near: near(), far: far() })
    expect(first).toEqual({
      look: 1,
      photos: 3,
      unusable: 1,
      incomplete: 0,
      bar: { median: 1, p90: 3 },
      detectors: {
        near: {
          overall: { photos: 2, median: 1, max: 1 },
          kinds: {
            grid: { photos: 1, median: 1, max: 1 },
            printed: { photos: 1, median: 1, max: 1 },
          },
          meetsBar: true,
        },
        far: {
          overall: { photos: 2, median: 5, max: 5 },
          kinds: {
            grid: { photos: 1, median: 5, max: 5 },
            printed: { photos: 1, median: 5, max: 5 },
          },
          meetsBar: false,
        },
      },
    })
    const second = await gate(folder, { near: near() })
    expect(second.look).toBe(2)
    const printed = JSON.stringify([first, second])
    for (const text of [...folder.names, ...folder.hashes]) expect(printed).not.toContain(text)
  })

  it('refuses to score when a label set byte changed', async () => {
    const folder = await frozenFolder()
    appendFileSync(folder.labels, ' ')
    await expect(gate(folder, { near: near() })).rejects.toThrow(
      'The label set file differs from the freeze file',
    )
  })

  it('refuses to score when a photo byte changed', async () => {
    const folder = await frozenFolder()
    const photo = join(folder.photos, folder.names[1])
    const bytes = readFileSync(photo)
    const at = bytes.length - 3
    bytes.writeUInt8(bytes.readUInt8(at) ^ 1, at)
    writeFileSync(photo, bytes)
    await expect(gate(folder, { near: near() })).rejects.toThrow(
      'A photo differs from the freeze file',
    )
  })

  it('refuses to score without a freeze file', async () => {
    const folder = await frozenFolder()
    rmSync(folder.freeze)
    await expect(gate(folder, { near: near() })).rejects.toThrow('No freeze file')
  })
})
