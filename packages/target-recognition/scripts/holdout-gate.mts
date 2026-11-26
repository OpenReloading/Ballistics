// The accuracy gate (apps/docs/docs/models/hole-detection.md, "Accuracy gate"), local only: node scripts/holdout-gate.mts freeze|score ...
import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  existsSync,
  ftruncateSync,
  openSync,
  readFileSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { nth } from '@rangefoundry/statistics'
import * as ort from 'onnxruntime-web'
import sharp from 'sharp'
import { z } from 'zod'
import {
  type CorrectionStats,
  correctionStats,
  corrections,
  holeDetector,
  type InferencePort,
  type LabeledPhoto,
  labelSet,
  learnedDetector,
  MAYBE_BELOW,
  matchHoles,
  modelManifest,
  type RgbaImage,
  type RunModel,
} from '../src/index.ts'

/** The photo folder, the labeler's label set file and the freeze file. */
export type GatePaths = { photos: string; labels: string; freeze: string }

/** One detector's corrections over the scored photos, overall and per kind, and whether they meet the default bar. */
export type DetectorScores = {
  overall: CorrectionStats | null
  kinds: Record<string, CorrectionStats>
  meetsBar: boolean | null
}

/** The printed result: the look number, the photo counts and each detector's scores; no file name, hash or per-photo figure. */
export type GateResult = {
  look: number
  photos: number
  unusable: number
  incomplete: number
  bar: { median: number; p90: number }
  detectors: Record<string, DetectorScores>
}

const BAR = { median: 1, p90: 3 }
const LOOKS = '.gate-looks'

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const hash = z.string().regex(/^[0-9a-f]{64}$/)
const freezeFile = z.strictObject({ labels: hash, photos: z.record(z.string(), hash) })

const readLabels = (path: string) => labelSet.parse(JSON.parse(readFileSync(path, 'utf8')))

/** Writes the SHA-256 of the label set file and of every photo it lists; refuses an existing freeze file. */
export function freeze({ photos, labels, freeze: out }: GatePaths): void {
  const set = readLabels(labels)
  const frozen = {
    labels: sha256(readFileSync(labels)),
    photos: Object.fromEntries(
      Object.keys(set.photos).map((name) => [name, sha256(readFileSync(join(photos, name)))]),
    ),
  }
  writeFileSync(out, `${JSON.stringify(frozen, null, 2)}\n`, { flag: 'wx' })
}

/** Each listed photo with its bytes when the files match the freeze file and the photos their labels; error texts name no photo. */
function frozenSet({ photos, labels, freeze: path }: GatePaths): {
  photo: LabeledPhoto
  bytes: Buffer
}[] {
  if (!existsSync(path)) throw new Error('No freeze file: write one before any model runs')
  const frozen = freezeFile.parse(JSON.parse(readFileSync(path, 'utf8')))
  const labelBytes = readFileSync(labels)
  if (sha256(labelBytes) !== frozen.labels)
    throw new Error('The label set file differs from the freeze file')
  const set = labelSet.parse(JSON.parse(labelBytes.toString('utf8')))
  const names = Object.keys(set.photos)
  if (
    names.length !== Object.keys(frozen.photos).length ||
    names.some((n) => !(n in frozen.photos))
  )
    throw new Error('The label set lists other photos than the freeze file')
  return Object.entries(set.photos).map(([name, photo]) => {
    const bytes = readFileSync(join(photos, name))
    const h = sha256(bytes)
    if (h !== frozen.photos[name]) throw new Error('A photo differs from the freeze file')
    if (h !== photo.sha256) throw new Error('A photo differs from its label')
    return { photo, bytes }
  })
}

/** Counts this look in the photo folder and returns its number. */
function nextLook(photos: string): number {
  // one descriptor for the read and the write, so no other file can come between them
  const fd = openSync(join(photos, LOOKS), constants.O_RDWR | constants.O_CREAT)
  try {
    const text = readFileSync(fd, 'utf8')
    const look = (text === '' ? 0 : Number.parseInt(text, 10)) + 1
    if (!Number.isSafeInteger(look)) throw new Error('The look counter is not a number')
    ftruncateSync(fd)
    writeSync(fd, `${look}\n`, 0)
    return look
  } finally {
    closeSync(fd)
  }
}

/** The photo as an RGBA buffer, EXIF rotation applied as a label tool shows it. */
async function decode(bytes: Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  }
}

/** Checks the freeze, counts the look, then scores each detector on the usable, complete photos at their labeled hole size. */
export async function gate(
  paths: GatePaths,
  detectors: Record<string, InferencePort>,
): Promise<GateResult> {
  const all = frozenSet(paths)
  const look = nextLook(paths.photos)
  const ports = Object.entries(detectors)
  const rows: { kind: string; counts: number[] }[] = []
  for (const { photo: p, bytes } of all.filter(({ photo }) => photo.usable && photo.complete)) {
    const image = await decode(bytes)
    if (image.width !== p.size[0] || image.height !== p.size[1])
      throw new Error('A photo size differs from its label')
    const counts: number[] = []
    for (const [, port] of ports) {
      const { proposals } = await port.propose({
        image,
        pxPerM: 1,
        expectedHoleDiameter: p.visibleDiameterPx,
        auto: true,
      })
      // the sure tier is what Accept sure takes over
      const marks = proposals.filter((q) => q.confidence >= MAYBE_BELOW)
      counts.push(corrections(matchHoles(marks, p.holes, p.visibleDiameterPx)))
    }
    rows.push({ kind: p.kind, counts })
  }
  return {
    look,
    photos: all.length,
    unusable: all.filter(({ photo }) => !photo.usable).length,
    incomplete: all.filter(({ photo }) => photo.usable && !photo.complete).length,
    bar: BAR,
    detectors: Object.fromEntries(
      ports.map(([d], i) => [
        d,
        scoresOf(rows.map((r) => ({ kind: r.kind, count: nth(r.counts, i) }))),
      ]),
    ),
  }
}

/** The corrections overall and per kind, kinds in name order. */
function scoresOf(rows: { kind: string; count: number }[]): DetectorScores {
  const overall = rows.length > 0 ? correctionStats(rows.map((r) => r.count)) : null
  const kinds = [...new Set(rows.map((r) => r.kind))].toSorted()
  return {
    overall,
    kinds: Object.fromEntries(
      kinds.map((k) => [k, correctionStats(rows.filter((r) => r.kind === k).map((r) => r.count))]),
    ),
    meetsBar: overall && overall.median <= BAR.median && (overall.p90 ?? overall.max) <= BAR.p90,
  }
}

/** A run function on onnxruntime-web, the app's runtime, single-threaded in Node. */
export async function onnxRun(model: Uint8Array): Promise<RunModel> {
  ort.env.wasm.numThreads = 1
  const session = await ort.InferenceSession.create(model)
  return async ({ data, dims }) => {
    const { heat } = await session.run({ image: new ort.Tensor('float32', data, dims) })
    if (!heat || !(heat.data instanceof Float32Array))
      throw new Error('The model has no float32 output named heat')
    return { data: heat.data, dims: heat.dims }
  }
}

if (import.meta.main) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      photos: { type: 'string' },
      labels: { type: 'string' },
      freeze: { type: 'string' },
      model: { type: 'string' },
      manifest: { type: 'string' },
    },
  })
  const [command] = positionals
  const { photos, labels, freeze: frozen, model, manifest } = values
  const paths = photos && labels && frozen ? { photos, labels, freeze: frozen } : null
  if (command === 'freeze' && paths) freeze(paths)
  else if (command === 'score' && paths && model && manifest) {
    const m = modelManifest.parse(JSON.parse(readFileSync(manifest, 'utf8')))
    const bytes = readFileSync(model)
    if (sha256(bytes) !== m.file.sha256) throw new Error('The model file differs from its manifest')
    const learned = learnedDetector(m, await onnxRun(bytes))
    const result = await gate(paths, { classical: holeDetector, learned })
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.error(
      'usage: holdout-gate.mts freeze --photos <dir> --labels <set.json> --freeze <out.json>\n' +
        '       holdout-gate.mts score --photos <dir> --labels <set.json> --freeze <freeze.json> --model <model.onnx> --manifest <manifest.json>',
    )
    process.exit(2)
  }
}
