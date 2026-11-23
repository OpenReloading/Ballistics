/** Writes seeded synthetic target photos of `synthetic.ts` and their `holes.json` in the label set format to a folder; run from packages/target-recognition: node test/fixtures/target-photos/make-synthetic.mts --out <dir> [--seed 1] [--count 100] [--size 512] [--diameter 8,48] [--holes 0,30] */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'
import type { LabeledPhoto } from '../../../src/label-set.ts'
import { type SynthOptions, synthesize } from './synthetic.ts'

/** Writes `count` photos of `seed` and `holes.json` to `dir`, which must be empty or new; the same arguments give the same bytes. */
export async function writePhotos(
  dir: string,
  seed: number,
  count: number,
  options: SynthOptions,
): Promise<void> {
  mkdirSync(dir, { recursive: true })
  // photos of an earlier run would sit beside a holes.json that does not list them
  if (readdirSync(dir).length > 0) throw new Error(`${dir} is not empty`)
  const photos: Record<string, LabeledPhoto> = {}
  for (let index = 0; index < count; index++) {
    const p = synthesize(seed, index, options)
    let image = sharp(Buffer.from(p.rgb.buffer), {
      raw: { width: p.size, height: p.size, channels: 3 },
    })
    if (p.blur > 0) image = image.blur(p.blur)
    const bytes = await image.jpeg({ quality: p.jpeg }).toBuffer()
    const file = `synthetic-${String(index).padStart(5, '0')}.jpg`
    writeFileSync(join(dir, file), bytes)
    photos[file] = {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      source: 'synthetic',
      license: 'ISC',
      author: 'make-synthetic.mts',
      session: `synthetic seed ${seed}`,
      kind: p.kind,
      usable: true,
      complete: true,
      size: [p.size, p.size],
      visibleDiameterPx: Math.round(p.visibleDiameterPx * 100) / 100,
      holes: p.holes.map((h) => ({
        x: Math.round(h.x * 10) / 10,
        y: Math.round(h.y * 10) / 10,
        uncertain: false,
      })),
    }
  }
  writeFileSync(join(dir, 'holes.json'), `${JSON.stringify({ photos }, null, 2)}\n`)
}

/** `text` as an integer, at least `min`. */
function whole(text: string, name: string, min: number): number {
  const n = Number(text)
  if (!/^\d+$/.test(text) || n < min)
    throw new Error(`--${name} must be an integer of at least ${min}, got ${text}`)
  return n
}

/** `text` as `low,high` with `min` <= low <= high. */
function range(text: string, name: string, min: number): [number, number] {
  const [low, high, ...rest] = text.split(',')
  if (low === undefined || high === undefined || rest.length > 0)
    throw new Error(`--${name} must be low,high, got ${text}`)
  const pair: [number, number] = [whole(low, name, min), whole(high, name, min)]
  if (pair[0] > pair[1]) throw new Error(`--${name} low must not exceed high, got ${text}`)
  return pair
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      seed: { type: 'string', default: '1' },
      count: { type: 'string', default: '100' },
      size: { type: 'string', default: '512' },
      // 0.5 to 3 times the 16 px working hole: 4.5 mm to .45 at one scale, and a wrongly expected size
      diameter: { type: 'string', default: '8,48' },
      holes: { type: 'string', default: '0,30' },
    },
  })
  if (!values.out) throw new Error('--out <dir> is required')
  await writePhotos(values.out, whole(values.seed, 'seed', 0), whole(values.count, 'count', 1), {
    size: whole(values.size, 'size', 32),
    diameter: range(values.diameter, 'diameter', 2),
    holes: range(values.holes, 'holes', 0),
  })
}
