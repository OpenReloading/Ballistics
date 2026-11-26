import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { modelManifest } from '@rangefoundry/target-recognition'
import { expect, it } from 'vitest'

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
