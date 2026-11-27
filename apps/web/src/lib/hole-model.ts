/** The detector of a detection run: the learned one when the served model loads in time, else the classical one. */
import {
  holeDetector,
  type InferencePort,
  learnedDetector,
  type ModelManifest,
  modelManifest,
  type ProposalRequest,
  type RunModel,
} from '@rangefoundry/target-recognition'

/** The served model's manifest (`apps/web/public/models/`), relative to the edition's base path like the `file.url` and `runtime.wasmPaths` it names. */
export const MODEL_MANIFEST = 'models/hole-model-0.1.0.json'

/** The limit on loading the manifest, the model and the runtime: both files (4.6 MB compressed) take about 23 s over a 1.6 Mbit/s mobile link. */
export const MODEL_LOAD_MS = 60_000

/** What a model load reads and runs on: `open` makes a run function of the model bytes with the runtime's files at `wasmPaths`; the load stops when `signal` aborts. */
export type ModelLoad = {
  fetch: (url: URL, signal: AbortSignal) => Promise<Response>
  open: (model: ArrayBuffer, wasmPaths: string) => Promise<RunModel>
  signal: AbortSignal
  report: (error: unknown) => void
}

/** The detector and whether a set model failed to load, so the page can say the classical detector answered. */
export type RunDetector = { detector: InferencePort; fellBack: boolean }

/** `root` (the edition's base path as an absolute URL ending in `/`, `editionRoot`) serves `MODEL_MANIFEST`, the model at its `file.url` and the runtime's files at its `runtime.wasmPaths`; a failed, mismatched or late load is reported and the classical detector answers. An example pick (`at`) and a run with the example's `polarity` or `backing` get the classical detector without a load: the learned one reads none of them and measures no hole size, which the example sets. */
export async function servedDetector(
  root: string | undefined,
  load: ModelLoad,
  request: Pick<ProposalRequest, 'at' | 'polarity' | 'backing'> = {},
): Promise<RunDetector> {
  if (!root || request.at || request.polarity || request.backing)
    return { detector: holeDetector, fellBack: false }
  try {
    return { detector: await untilAborted(learned(root, load), load.signal), fellBack: false }
  } catch (error) {
    load.report(error)
    return { detector: holeDetector, fellBack: true }
  }
}

async function learned(root: string, load: ModelLoad) {
  const manifest = modelManifest.parse(await (await read(load, MODEL_MANIFEST, root)).json())
  const model = await (await read(load, manifest.file.url, root)).arrayBuffer()
  await checkFile(model, manifest.file)
  const wasmPaths = new URL(manifest.runtime.wasmPaths, root).href
  return learnedDetector(manifest, await load.open(model, wasmPaths))
}

async function read(load: ModelLoad, path: string, root: string) {
  const url = new URL(path, root)
  const response = await load.fetch(url, load.signal)
  if (!response.ok) throw new Error(`${url.href}: HTTP ${response.status}`)
  return response
}

/** A stale or cut file with the same input and output names would run and give wrong proposals with no error. */
async function checkFile(model: ArrayBuffer, file: ModelManifest['file']) {
  if (model.byteLength !== file.bytes)
    throw new Error(`${file.name}: ${model.byteLength} bytes, the manifest names ${file.bytes}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', model))
  const sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  if (sha256 !== file.sha256)
    throw new Error(`${file.name}: SHA-256 ${sha256}, the manifest names ${file.sha256}`)
}

/** The session create takes no signal, so the whole load races it. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      if (signal.aborted) reject(signal.reason)
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  ])
}
