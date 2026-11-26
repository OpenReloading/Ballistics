import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { modelManifest } from '@rangefoundry/target-recognition'
import { expect, it } from 'vitest'

const models = new URL('../public/models/', import.meta.url)

it('the hole model manifest parses and names the size and SHA-256 of the file served beside it', () => {
  const manifest = modelManifest.parse(
    JSON.parse(readFileSync(new URL('hole-model-0.1.0.json', models), 'utf8')),
  )
  const file = readFileSync(new URL(manifest.file.name, models))
  expect(manifest.file.url).toBe(
    'https://openreloading.github.io/Ballistics/next/models/hole-model-0.1.0.onnx',
  )
  expect(file.byteLength).toBe(manifest.file.bytes)
  expect(createHash('sha256').update(file).digest('hex')).toBe(manifest.file.sha256)
})
