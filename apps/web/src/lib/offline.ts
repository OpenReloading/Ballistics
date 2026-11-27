/** Records fetched through `/api/`: JSON that stays valid across builds, so no build in the name. */
export const recordsCache = 'rangefoundry-records'
export const offlinePage = '/offline'

/** A WebAssembly or ONNX file: the model runtime and the model load from outside the client output (`src/lib/onnx-model.ts`), so no script output holds one. */
export const isModelFile = (file: string) => /\.(wasm|onnx)$/.test(file)
