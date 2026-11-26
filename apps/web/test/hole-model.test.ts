import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { holeDetector, modelManifest, type RunModel } from '@rangefoundry/target-recognition'
import { describe, expect, it } from 'vitest'
import { editionRoot } from '../src/lib/dev-model.ts'
import { type ModelLoad, servedDetector } from '../src/lib/hole-model.ts'
import { wasmSettings } from '../src/lib/onnx-model.ts'

const site = new URL('../public/', import.meta.url)

it('the hole model manifest parses and names the size and SHA-256 of the file its url serves under the base path', () => {
  const manifest = modelManifest.parse(
    JSON.parse(readFileSync(new URL('models/hole-model-0.1.0.json', site), 'utf8')),
  )
  expect(manifest.file.url).toBe('models/hole-model-0.1.0.onnx')
  const file = readFileSync(new URL(manifest.file.url, site))
  expect(file.byteLength).toBe(manifest.file.bytes)
  expect(createHash('sha256').update(file).digest('hex')).toBe(manifest.file.sha256)
})

const root = 'https://openreloading.github.io/Ballistics/next/'

/** A manifest of the 3-byte model file `abc` (SHA-256 the FIPS 180-2 test vector of `abc`). */
const manifest = {
  schemaVersion: 1,
  id: 'hole-model',
  version: '0.1.0',
  file: {
    name: 'hole-model-0.1.0.onnx',
    url: 'models/hole-model-0.1.0.onnx',
    sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    bytes: 3,
  },
  runtime: { package: 'onnxruntime-web', version: '1.31.1', wasmPaths: 'models/ort/', opset: 17 },
  input: { holePx: 16, channels: 'rgb', range: [0, 1], sizeMultiple: 16 },
  output: { stride: 2, channels: 1, threshold: 0.35, sure: 0.6 },
  license: {
    model: 'CC0-1.0',
    training: { classes: { own: 0, 'third-party': 0, synthetic: 100 }, kinds: { printed: 100 } },
  },
  measured: {
    synthetic: { photos: 10, median: 0, p90: null, max: 1 },
    holdout: null,
    parity: 0,
  },
}

/** A 32 px white image with a 16 px expected hole: the working image is the image itself, its heatmap 16 x 16 cells. */
const request = {
  image: { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4).fill(255) },
  pxPerM: 1600,
  expectedHoleDiameter: 0.01,
}

/** A heatmap with one sure peak, in cell (5, 5). */
const run: RunModel = async () => {
  const data = new Float32Array(16 * 16)
  data[5 * 16 + 5] = 1
  return { data, dims: [1, 1, 16, 16] }
}

type Serve = (url: string, signal: AbortSignal) => Promise<Response>

/** Serves the manifest and `model` under `base`, anything else as 404. */
const files =
  (base: string, model: string): Serve =>
  async (url) => {
    if (url === `${base}models/hole-model-0.1.0.json`) return Response.json(manifest)
    if (url === `${base}models/hole-model-0.1.0.onnx`) return new Response(model)
    return new Response(null, { status: 404 })
  }

function load(
  serve: Serve,
  open: ModelLoad['open'] = async () => run,
  signal = new AbortController().signal,
) {
  const fetched: string[] = []
  const opened: string[] = []
  const reported: unknown[] = []
  const loader: ModelLoad = {
    fetch: (url, s) => {
      fetched.push(url.href)
      return serve(url.href, s)
    },
    open: (model, wasmPaths) => {
      opened.push(wasmPaths)
      return open(model, wasmPaths)
    },
    signal,
    report: (error) => reported.push(error),
  }
  return { loader, fetched, opened, reported }
}

/** A request that never answers until its signal aborts, as a stalling host. */
const stalled: Serve = (_, signal) =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))

describe('servedDetector', () => {
  it('answers with the classical detector when no model is set', async () => {
    const { loader, fetched } = load(files(root, 'abc'))
    expect(await servedDetector(undefined, loader)).toEqual({
      detector: holeDetector,
      fellBack: false,
    })
    expect(fetched).toEqual([])
  })

  it.each([
    ['', 'https://example.org/'],
    ['/Ballistics/next', 'https://openreloading.github.io/Ballistics/next/'],
  ])(
    'with base path "%s" loads the manifest, the model and the runtime under %s',
    async (base, at) => {
      const { loader, fetched, opened } = load(files(at, 'abc'))
      const { detector, fellBack } = await servedDetector(
        editionRoot(base, new URL(at).origin),
        loader,
      )
      expect(fellBack).toBe(false)
      expect(fetched).toEqual([
        `${at}models/hole-model-0.1.0.json`,
        `${at}models/hole-model-0.1.0.onnx`,
      ])
      expect(opened).toEqual([`${at}models/ort/`])
      expect((await detector.propose(request)).proposals).toMatchObject([
        { x: 10.5, y: 10.5, confidence: 1 },
      ])
    },
  )

  it.each([
    ['size', 'abcd', 'hole-model-0.1.0.onnx: 4 bytes, the manifest names 3'],
    [
      'SHA-256',
      'abd',
      'hole-model-0.1.0.onnx: SHA-256 a52d159f262b2c6ddb724a61840befc36eb30c88877a4030b65cbe86298449c9, the manifest names ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ],
  ])(
    'falls back to the classical detector before opening a model of another %s',
    async (_, model, message) => {
      const { loader, opened, reported } = load(files(root, model))
      expect(await servedDetector(root, loader)).toEqual({ detector: holeDetector, fellBack: true })
      expect(opened).toEqual([])
      expect(reported).toEqual([new Error(message)])
    },
  )

  it('falls back to the classical detector when the load passes its time limit on a stalled fetch', async () => {
    const limit = new AbortController()
    const { loader, opened, reported } = load(stalled, undefined, limit.signal)
    const result = servedDetector(root, loader)
    limit.abort(new DOMException('timed out', 'TimeoutError'))
    expect(await result).toEqual({ detector: holeDetector, fellBack: true })
    expect(opened).toEqual([])
    expect(String(reported)).toBe('TimeoutError: timed out')
  })

  it('falls back to the classical detector when the runtime does not open within the time limit', async () => {
    const { loader, reported } = load(
      files(root, 'abc'),
      () => new Promise(() => {}),
      AbortSignal.timeout(20),
    )
    expect(await servedDetector(root, loader)).toEqual({ detector: holeDetector, fellBack: true })
    expect(reported).toMatchObject([{ name: 'TimeoutError' }])
  })

  it('falls back to the classical detector and reports the error when the runtime throws on load', async () => {
    const failure = new Error('no wasm')
    const { loader, reported } = load(files(root, 'abc'), async () => {
      throw failure
    })
    expect(await servedDetector(root, loader)).toEqual({ detector: holeDetector, fellBack: true })
    expect(reported).toEqual([failure])
  })

  it('falls back to the classical detector when the edition serves no manifest', async () => {
    const { loader, reported, opened } = load(files('https://example.org/', 'abc'))
    expect((await servedDetector(root, loader)).detector).toBe(holeDetector)
    expect(String(reported)).toBe(
      'Error: https://openreloading.github.io/Ballistics/next/models/hole-model-0.1.0.json: HTTP 404',
    )
    expect(opened).toEqual([])
  })
})

describe('wasmSettings', () => {
  it('runs the runtime on one thread from the given folder', () => {
    expect(wasmSettings('http://localhost:4000/models/ort/')).toEqual({
      wasmPaths: 'http://localhost:4000/models/ort/',
      numThreads: 1,
    })
  })
})
