/** ONNX Runtime Web on WebAssembly without WebGPU; vite.config.mts and next.config.ts alias `onnxruntime-web/wasm` to the build that loads its WASM files from `wasmPaths`, so no build output holds them. */
import { ModelContractError, type RunModel } from '@rangefoundry/target-recognition'

/** One thread: threads need cross-origin isolation, which a static host does not send. */
export const wasmSettings = (wasmPaths: string) => ({ wasmPaths, numThreads: 1 })

/** A run function over an inference session of `model`, its runtime's files loaded from `wasmPaths`. */
export async function openOnnxModel(model: ArrayBuffer, wasmPaths: string): Promise<RunModel> {
  const ort = await import('onnxruntime-web/wasm')
  Object.assign(ort.env.wasm, wasmSettings(wasmPaths))
  const session = await ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: ['wasm'],
  })
  const [input] = session.inputNames
  const [output] = session.outputNames
  if (input === undefined || output === undefined)
    throw new ModelContractError('The model has no input or no output')
  return async ({ data, dims }) => {
    const heat = (await session.run({ [input]: new ort.Tensor('float32', data, dims) }))[output]
    if (!(heat?.data instanceof Float32Array))
      throw new ModelContractError(`The model output ${output} is no float32 tensor`)
    return { data: heat.data, dims: heat.dims }
  }
}
