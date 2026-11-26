/** The detector of a detection run: the learned one when a model folder is set and loads, else the classical one. */
import {
  holeDetector,
  type InferencePort,
  learnedDetector,
  modelManifest,
  type RunModel,
} from '@rangefoundry/target-recognition'

/** What a model load reads and runs on: `open` makes a run function of the model bytes with the runtime's files at `wasmPaths`. */
export type ModelLoad = {
  fetch: (url: URL) => Promise<Response>
  open: (model: ArrayBuffer, wasmPaths: string) => Promise<RunModel>
  report: (error: unknown) => void
}

/** `folder` (an absolute URL ending in `/`) holds `manifest.json`, the model file it names and the runtime's files at its `runtime.wasmPaths`, resolved against the folder; a failed load is reported and the classical detector answers. */
export async function folderDetector(
  folder: string | undefined,
  load: ModelLoad,
): Promise<InferencePort> {
  if (!folder) return holeDetector
  try {
    const manifest = modelManifest.parse(await (await read(load, 'manifest.json', folder)).json())
    const model = await (await read(load, manifest.file.name, folder)).arrayBuffer()
    const wasmPaths = new URL(manifest.runtime.wasmPaths, folder).href
    return learnedDetector(manifest, await load.open(model, wasmPaths))
  } catch (error) {
    load.report(error)
    return holeDetector
  }
}

async function read(load: ModelLoad, name: string, folder: string) {
  const url = new URL(name, folder)
  const response = await load.fetch(url)
  if (!response.ok) throw new Error(`${url.href}: HTTP ${response.status}`)
  return response
}
