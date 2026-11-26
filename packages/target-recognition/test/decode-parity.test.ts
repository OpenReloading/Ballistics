import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { onnxRun } from '../scripts/holdout-gate.mts'
import { learnedDetector } from '../src/learned-detector.ts'
import { modelManifest } from '../src/model-manifest.ts'

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url))

// the photo of fixtures/decode-parity/make.py: white, black disks of radius 8 px around these centers
const [WIDTH, HEIGHT, RADIUS] = [70, 50, 8]
const CENTERS = [
  [20.5, 24.5],
  [50.5, 16.5],
  [40.5, 38.5],
] as const
// what make.py prints: the training project's scoring on the same model and photo
const PYTHON_PEAKS = [
  [50, 16],
  [20, 24],
  [40, 38],
] as const

function disks() {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(255)
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      if (CENTERS.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= RADIUS ** 2))
        data.fill(0, (y * WIDTH + x) * 4, (y * WIDTH + x) * 4 + 3)
  return { width: WIDTH, height: HEIGHT, data }
}

describe('decode parity', () => {
  it('finds the peaks of the Python scoring within 1 px from the ONNX output', async () => {
    // the manifest fixture's input and output contracts are the training project's
    const manifest = modelManifest.parse(JSON.parse(fixture('model-manifest.json').toString()))
    const port = learnedDetector(manifest, await onnxRun(fixture('decode-parity/dark-disks.onnx')))
    const { proposals } = await port.propose({
      image: disks(),
      pxPerM: 1,
      expectedHoleDiameter: 2 * RADIUS,
    })
    expect(proposals).toHaveLength(PYTHON_PEAKS.length)
    for (const [x, y] of PYTHON_PEAKS)
      expect(proposals.some((p) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1)).toBe(true)
  })
})
