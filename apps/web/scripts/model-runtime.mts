/** Copies the ONNX Runtime Web files of the installed `onnxruntime-web` into public/ at the served model manifest's `runtime.wasmPaths`, so every build and base path serves them beside the model; fails when the manifest names another runtime or version. */
import { cpSync, mkdirSync, readFileSync } from 'node:fs'
import { modelManifest } from '@rangefoundry/target-recognition'
import { MODEL_MANIFEST } from '../src/lib/hole-model.ts'

const at = (p: string) => new URL(`../${p}`, import.meta.url)
const { runtime } = modelManifest.parse(
  JSON.parse(readFileSync(at(`public/${MODEL_MANIFEST}`), 'utf8')),
)
const installed = `onnxruntime-web ${JSON.parse(readFileSync(at('node_modules/onnxruntime-web/package.json'), 'utf8')).version}`
if (`${runtime.package} ${runtime.version}` !== installed)
  throw new Error(`${MODEL_MANIFEST} names ${runtime.package} ${runtime.version}, not ${installed}`)
// the files the `onnxruntime-web/wasm` build loads from `wasmPaths` on single-thread WebAssembly
const files = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']
mkdirSync(at(`public/${runtime.wasmPaths}`), { recursive: true })
for (const file of files)
  cpSync(at(`node_modules/onnxruntime-web/dist/${file}`), at(`public/${runtime.wasmPaths}${file}`))
console.log(`public/${runtime.wasmPaths}: ${files.join(', ')} of ${installed}`)
