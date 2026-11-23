import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { modelManifest } from '../src/model-manifest.ts'

const example = JSON.parse(
  readFileSync(join(import.meta.dirname, 'fixtures', 'model-manifest.json'), 'utf8'),
)
const withFile = (file: object) => ({ ...example, file: { ...example.file, ...file } })
const withTraining = (training: object) => ({
  ...example,
  license: { ...example.license, training: { ...example.license.training, ...training } },
})
const withClasses = (classes: object) =>
  withTraining({ classes: { ...example.license.training.classes, ...classes } })
const { model: _, ...licenseWithoutModel } = example.license
const trainingPath = ['license', 'training']

const rejected: [string, object, object][] = [
  [
    'an unknown key',
    { ...example, notes: 'x' },
    { code: 'unrecognized_keys', keys: ['notes'], path: [] },
  ],
  ...['sources', 'credits'].map((key): [string, object, object] => [
    `${key} in the training data summary`,
    withTraining({ [key]: [] }),
    { code: 'unrecognized_keys', keys: [key], path: trainingPath },
  ]),
  ...['https://example.org/t/1/photo.jpg', 'photo-1.jpg', 'photo by J. Doe, CC BY 4.0'].map(
    (kind): [string, object, object] => [
      `${kind} as a target kind`,
      withTraining({ kinds: { [kind]: 1 } }),
      { code: 'invalid_key', path: [...trainingPath, 'kinds', kind] },
    ],
  ),
  [
    'an id that is not a slug',
    { ...example, id: 'Hole heatmap, photos by J. Doe' },
    { code: 'invalid_format', format: 'regex', path: ['id'] },
  ],
  [
    'a credit line in the model license',
    { ...example, license: { ...example.license, model: 'CC0-1.0; photos by J. Doe' } },
    { code: 'invalid_format', format: 'regex', path: ['license', 'model'] },
  ],
  [
    'a sha256 that is not 64 hex characters',
    withFile({ sha256: '9f86d081' }),
    { code: 'invalid_format', format: 'regex', path: ['file', 'sha256'] },
  ],
  [
    'zero bytes',
    withFile({ bytes: 0 }),
    { code: 'too_small', minimum: 0, inclusive: false, path: ['file', 'bytes'] },
  ],
  [
    'a url that is not https',
    withFile({ url: 'http://example.org/m.onnx' }),
    { code: 'invalid_format', format: 'url', path: ['file', 'url'] },
  ],
  [
    'no model license',
    { ...example, license: licenseWithoutModel },
    { code: 'invalid_type', expected: 'string', path: ['license', 'model'] },
  ],
  [
    'a negative data class count',
    withClasses({ own: -1 }),
    { code: 'too_small', minimum: 0, path: [...trainingPath, 'classes', 'own'] },
  ],
  [
    'a data class count that is not an integer',
    withClasses({ synthetic: 1.5 }),
    { code: 'invalid_type', expected: 'int', path: [...trainingPath, 'classes', 'synthetic'] },
  ],
  [
    'a schema version it does not know',
    { ...example, schemaVersion: 2 },
    { code: 'invalid_value', values: [1], path: ['schemaVersion'] },
  ],
  ...[0, -16].map((holePx): [string, object, object] => [
    `a working hole size of ${holePx}`,
    { ...example, input: { ...example.input, holePx } },
    { code: 'too_small', minimum: 0, inclusive: false, path: ['input', 'holePx'] },
  ]),
  [
    'a file name with a path',
    withFile({ name: '../model.onnx' }),
    { code: 'invalid_format', format: 'regex', path: ['file', 'name'] },
  ],
  [
    'a runtime version range',
    { ...example, runtime: { ...example.runtime, version: '^1.31.1' } },
    { code: 'invalid_format', format: 'regex', path: ['runtime', 'version'] },
  ],
  [
    'an input range whose minimum is not below its maximum',
    { ...example, input: { ...example.input, range: [1, 0] } },
    { code: 'custom', path: ['input', 'range'] },
  ],
  [
    'a sure value below the default threshold',
    { ...example, output: { ...example.output, sure: 0.2 } },
    { code: 'custom', message: 'sure below threshold', path: ['output', 'sure'] },
  ],
  [
    'a default threshold above 1',
    { ...example, output: { ...example.output, threshold: 1.5 } },
    { code: 'too_big', maximum: 1, path: ['output', 'threshold'] },
  ],
  [
    'a default threshold below 0',
    { ...example, output: { ...example.output, threshold: -0.1 } },
    { code: 'too_small', minimum: 0, path: ['output', 'threshold'] },
  ],
]

describe('model manifest schema', () => {
  it('parses the example to an equal value', () => {
    expect(modelManifest.parse(example)).toEqual(example)
  })

  for (const [name, manifest, issue] of rejected)
    it(`rejects ${name}`, () => {
      expect(modelManifest.safeParse(manifest).error?.issues).toMatchObject([issue])
    })
})
