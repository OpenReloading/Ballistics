import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { run } from '../src/main.ts'
import { rowsPath } from './data.ts'
import { recordRoots, rowsCsv, writeRows } from './fixture.ts'

vi.mock('@rangefoundry/catalog-files', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@rangefoundry/catalog-files')>(),
  ),
)

const repo = join(import.meta.dirname, '../../..')
const { version } = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'))
const worse = join(import.meta.dirname, 'fixtures/worse-model.mjs')
const records = recordRoots.flatMap((r) => ['--records', r])
const data = ['--rows', rowsPath, ...records]
// a fit runs the model many times per powder: five rows of one powder keep it short
const few = [
  '--rows',
  writeRows(
    rowsCsv([
      ...[2.0, 2.2, 2.4].map((charge) => ({ cartridge: '30-br', charge, velocity: 0.01 })),
      ...[2.0, 2.2].map((charge) => ({ cartridge: '308-match', charge, velocity: 0.01 })),
    ]),
  ),
  ...records,
]
const example = JSON.parse(
  readFileSync(join(import.meta.dirname, '../examples/interior.json'), 'utf8'),
)
// the example's curve point every 2 us makes a long answer: every 100 us keeps the golden short
const interiorBody = writeRows(
  JSON.stringify({ ...example, options: { outputStep: 0.0001 } }),
  'interior.json',
)
const badRows = writeRows('cartridge,bullet,powder,charge_g,velocity_ms\n308-match,b,p,x,800\n')
const throwOnWrite = () => {
  throw new Error('no space left\non the device')
}

/** The command lines whose exit code, stdout and stderr each golden holds, by golden name. */
const cases: Record<
  string,
  { args: string[]; tty?: boolean; write?: () => void; stdout?: (text: string) => string }
> = {
  help: { args: ['--help'] },
  'help-verify': { args: ['verify', '--help'] },
  'help-compare': { args: ['compare', '--help'] },
  'help-fit': { args: ['fit', '--help'] },
  'help-run': { args: ['run', '--help'] },
  'help-estimate-capacities': { args: ['estimate-capacities', '--help'] },
  'help-operations': { args: ['operations', '--help'] },
  version: { args: ['--version'] },
  verify: { args: ['verify', ...data, '--group-by', 'cartridge'] },
  'verify-table': { args: ['verify', ...data, '--group-by', 'cartridge'], tty: true },
  compare: { args: ['compare', ...data, '--baseline', 'm3', '--candidate', worse] },
  'compare-table': {
    args: ['compare', ...data, '--baseline', 'm3', '--candidate', worse],
    tty: true,
  },
  fit: { args: ['fit', ...few] },
  'fit-table': { args: ['fit', ...few], tty: true },
  run: { args: ['run', 'interior', '--input', interiorBody] },
  // the JSON Schemas of the bodies are the API's, which its own contract check covers
  operations: { args: ['operations'], stdout: withoutSchemas },
  'estimate-capacities': {
    args: [
      'estimate-capacities',
      '--out',
      mkdtempSync(join(tmpdir(), 'cli-estimates-')),
      ...records,
    ],
  },
  'exit-1-refused': { args: ['verify', ...data, '--split', 'test'] },
  'exit-1-refused-table': { args: ['verify', ...data, '--split', 'test'], tty: true },
  'exit-64-usage': { args: ['verify', '--rows', 'x.csv', '--nope'] },
  'exit-64-usage-table': { args: ['verify', '--rows', 'x.csv', '--nope'], tty: true },
  'exit-65-data': { args: ['verify', '--rows', badRows, ...records] },
  'exit-65-data-table': { args: ['verify', '--rows', badRows, ...records], tty: true },
  'exit-66-no-input': { args: ['run', 'interior', '--input', '/nonexistent/body.json'] },
  'exit-66-no-input-table': {
    args: ['run', 'interior', '--input', '/nonexistent/body.json'],
    tty: true,
  },
  'exit-70-internal': { args: ['verify', ...data], write: throwOnWrite },
  'exit-70-internal-table': { args: ['verify', ...data], tty: true, write: throwOnWrite },
}

/** The operations list with each JSON Schema replaced by a marker, in the command's own layout. */
function withoutSchemas(text: string) {
  const { operations } = JSON.parse(text) as { operations: Record<string, unknown>[] }
  const marked = operations.map((o) => ({ ...o, input: '<JSON Schema>', output: '<JSON Schema>' }))
  return `${JSON.stringify({ operations: marked }, null, 2)}\n`
}

/** Replaces what differs between machines and releases: temporary folders, the clone, hashes and the version. */
function stable(text: string) {
  return text
    .replaceAll(/[^\s"']*\/cli-(?:rows|estimates)-[A-Za-z0-9]+/g, '<tmp>')
    .replaceAll(repo, '<repo>')
    .replaceAll(/\b[0-9a-f]{64}\b/g, '<sha256>')
    .replaceAll(`ballistics ${version}`, 'ballistics <version>')
}

describe('the goldens in test/golden (pnpm run golden:update rewrites them)', () => {
  it.each(Object.entries(cases))('match %s byte for byte', async (name, c) => {
    let stdout = ''
    let stderr = ''
    const code = await run(
      c.args,
      {},
      {
        stdout: (text) => {
          c.write?.()
          stdout += text
        },
        stderr: (text) => {
          stderr += text
        },
        tty: c.tty === true,
      },
    )
    await expect(
      stable(`exit ${code}\n--- stdout\n${c.stdout?.(stdout) ?? stdout}--- stderr\n${stderr}`),
    ).toMatchFileSnapshot(`golden/${name}.txt`)
  })
})
