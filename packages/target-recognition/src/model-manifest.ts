import { z } from 'zod'

/** Corrections per usable photo in the quality bar's metric; `p90` is null below 20 photos. */
export type ModelScores = { photos: number; median: number; p90: number | null; max: number }

/** One model file and the contract its detector, download and accuracy gate share; `test/fixtures/model-manifest.json` is an example. */
export type ModelManifest = {
  schemaVersion: 1
  id: string
  version: string
  /** The model file: `url` https only, `bytes` and `sha256` checked after the download. */
  file: { name: string; url: string; sha256: string; bytes: number }
  /** The npm runtime package and the exact version the app pins, `wasmPaths` where it loads its WASM files from, and the ONNX opset. */
  runtime: { package: string; version: string; wasmPaths: string; opset: number }
  /** `holePx` the working hole diameter in px, `range` the pixel values' minimum and maximum, `sizeMultiple` what width and height are padded to. */
  input: { holePx: number; channels: 'rgb' | 'bgr'; range: [number, number]; sizeMultiple: number }
  /** `stride` input px per heatmap cell; `threshold` (set on the validation split) drops lower peaks, a peak at `sure` or above maps to the sure confidence tier. */
  output: { stride: number; channels: number; threshold: number; sure: number }
  /** The model license and the training photos as counts only, per data class and per target kind; no photo or source is listed. */
  license: {
    model: string
    training: {
      classes: { own: number; 'third-party': number; synthetic: number }
      kinds: Record<string, number>
    }
  }
  /** Synthetic and holdout scores (holdout null until it is scored) and the largest output difference between PyTorch and ONNX Runtime. */
  measured: { synthetic: ModelScores; holdout: ModelScores | null; parity: number }
}

const text = z.string().min(1)
const count = z.number().int().nonnegative()
const share = z.number().min(0).max(1)
const positiveInt = z.number().int().positive()

const scores = z.strictObject({
  photos: count,
  median: z.number().nonnegative(),
  p90: z.number().nonnegative().nullable(),
  max: z.number().nonnegative(),
})

/** Schema of a model manifest file. */
export const modelManifest: z.ZodType<ModelManifest> = z.strictObject({
  schemaVersion: z.literal(1),
  id: text,
  version: text,
  file: z.strictObject({
    // a bare file name, so a download cannot write outside its folder
    name: z.string().regex(/^[\w-]+(\.[\w-]+)*$/),
    url: z.url({ protocol: /^https$/ }),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    bytes: positiveInt,
  }),
  runtime: z.strictObject({
    package: text,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    wasmPaths: text,
    opset: positiveInt,
  }),
  input: z.strictObject({
    holePx: z.number().positive(),
    channels: z.enum(['rgb', 'bgr']),
    range: z
      .tuple([z.number(), z.number()])
      .refine(([min, max]) => min < max, 'range minimum not below its maximum'),
    sizeMultiple: positiveInt,
  }),
  output: z
    .strictObject({
      stride: positiveInt,
      channels: positiveInt,
      threshold: share,
      sure: share,
    })
    .refine((o) => o.sure >= o.threshold, {
      message: 'sure below threshold',
      path: ['sure'],
      when: (payload) => payload.issues.length === 0,
    }),
  license: z.strictObject({
    model: text,
    training: z.strictObject({
      classes: z.strictObject({ own: count, 'third-party': count, synthetic: count }),
      kinds: z.record(text, count),
    }),
  }),
  measured: z.strictObject({
    synthetic: scores,
    holdout: scores.nullable(),
    parity: z.number().nonnegative(),
  }),
})
