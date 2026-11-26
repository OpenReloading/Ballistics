import { holeDetector, type RunModel } from '@rangefoundry/target-recognition'
import { describe, expect, it } from 'vitest'
import { folderDetector, type ModelLoad } from '../src/lib/hole-model.ts'
import { wasmSettings } from '../src/lib/onnx-model.ts'

const folder = 'http://localhost:4000/model/'

const manifest = {
  schemaVersion: 1,
  id: 'hole-heatmap',
  version: '0.1.0',
  file: {
    name: 'hole-heatmap-0.1.0.onnx',
    url: 'https://example.org/models/hole-heatmap-0.1.0.onnx',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    bytes: 3,
  },
  runtime: { package: 'onnxruntime-web', version: '1.31.1', wasmPaths: 'ort/', opset: 17 },
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

/** Serves the manifest and the model file from `folder`, anything else as 404. */
function load(open: ModelLoad['open'], files = ['manifest.json', manifest.file.name]) {
  const reported: unknown[] = []
  const opened: string[] = []
  const loader: ModelLoad = {
    fetch: async (url) => {
      const name = url.href.slice(folder.length)
      if (!files.includes(name)) return new Response(null, { status: 404 })
      return new Response(name === 'manifest.json' ? JSON.stringify(manifest) : 'abc')
    },
    open: (model, wasmPaths) => {
      opened.push(wasmPaths)
      return open(model, wasmPaths)
    },
    report: (error) => reported.push(error),
  }
  return { loader, reported, opened }
}

describe('folderDetector', () => {
  it('answers with the classical detector when no model folder is set', async () => {
    const { loader, reported } = load(async () => run)
    expect(await folderDetector(undefined, loader)).toBe(holeDetector)
    expect(reported).toEqual([])
  })

  it('answers with the learned detector of the folder, the runtime files resolved against it', async () => {
    const { loader, opened } = load(async () => run)
    const found = await (await folderDetector(folder, loader)).propose(request)
    expect(found.proposals).toMatchObject([{ x: 10.5, y: 10.5, confidence: 1 }])
    expect(opened).toEqual(['http://localhost:4000/model/ort/'])
  })

  it('falls back to the classical detector and reports the error when the runtime throws on load', async () => {
    const failure = new Error('no wasm')
    const { loader, reported } = load(async () => {
      throw failure
    })
    expect(await folderDetector(folder, loader)).toBe(holeDetector)
    expect(reported).toEqual([failure])
  })

  it('falls back to the classical detector when the folder has no model file', async () => {
    const { loader, reported, opened } = load(async () => run, ['manifest.json'])
    expect(await folderDetector(folder, loader)).toBe(holeDetector)
    expect(String(reported)).toBe(
      'Error: http://localhost:4000/model/hole-heatmap-0.1.0.onnx: HTTP 404',
    )
    expect(opened).toEqual([])
  })
})

describe('wasmSettings', () => {
  it('runs the runtime on one thread from the given folder', () => {
    expect(wasmSettings('http://localhost:4000/model/ort/')).toEqual({
      wasmPaths: 'http://localhost:4000/model/ort/',
      numThreads: 1,
    })
  })
})
