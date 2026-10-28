import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import { run } from '../src/main.ts'
import { result } from '../src/result.ts'
import { resultJsonSchema } from '../src/write-json-schema.ts'
import { rowsPath } from './data.ts'
import { recordRoots, rowsCsv, writeRows } from './fixture.ts'

const schemaPath = join(import.meta.dirname, '../schema/result.schema.json')
const worse = new URL('./fixtures/worse-model.mjs', import.meta.url).pathname

/** Runs the command line and returns the exit code and what it wrote. */
async function cli(args: string[], env: NodeJS.ProcessEnv = {}, tty = false) {
  let stdout = ''
  let stderr = ''
  const code = await run(args, env, {
    stdout: (t) => {
      stdout += t
    },
    stderr: (t) => {
      stderr += t
    },
    tty,
  })
  return { code, stdout, stderr }
}

const data = ['--rows', rowsPath, ...recordRoots.flatMap((r) => ['--records', r])]

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')))

describe('the JSON result', () => {
  it('validates against the committed schema, for both commands', async () => {
    for (const args of [
      ['verify', ...data],
      ['verify', ...data, '--split', 'test', '--final'],
      ['verify', ...data, '--group-by', 'construction', '--params', 'records'],
      ['compare', ...data, '--group-by', 'family', '--baseline', 'm3', '--candidate', worse],
      ['compare', ...data, '--baseline', 'm3', '--candidate', worse],
    ]) {
      const { code, stdout } = await cli(args)
      expect(code).toBe(0)
      const json = JSON.parse(stdout)
      expect(validate(json), JSON.stringify(validate.errors)).toBe(true)
      expect(json.schemaVersion).toBe(1)
      expect(result.safeParse(json).success).toBe(true)
    }
  })

  it('rejects a result of another shape', () => {
    expect(validate({ schemaVersion: 2, command: 'verify' })).toBe(false)
    expect(validate({ schemaVersion: 1, command: 'run' })).toBe(false)
  })

  it('is the schema the package generates (npm run schema)', () => {
    expect(JSON.parse(readFileSync(schemaPath, 'utf8'))).toEqual(JSON.parse(resultJsonSchema()))
  })
})

describe('the records', () => {
  it('notes a record that fails its schema on stderr and still gives the result', async () => {
    const bad = mkdtempSync(join(tmpdir(), 'cli-records-'))
    mkdirSync(join(bad, 'powders'))
    writeFileSync(join(bad, 'powders', 'broken.json'), '{"id":"broken"}')
    const r = await cli(['verify', ...data, '--records', bad])
    expect(r.code).toBe(0)
    expect(r.stderr).toMatch(/^\d+ problem\(s\) in the records/)
    expect(JSON.parse(r.stdout).command).toBe('verify')
    expect((await cli(['verify', ...data])).stderr).toBe('')
  })
})

describe('exit codes', () => {
  it('is 0 for a result', async () => {
    expect((await cli(['verify', ...data])).code).toBe(0)
  })

  it('is 1 for the test split without --final and for a split without a usable row', async () => {
    const sealed = await cli(['verify', ...data, '--split', 'test'])
    expect(sealed.code).toBe(1)
    expect(sealed.stdout).toBe('')
    expect(sealed.stderr).toContain('sealed')
    expect(
      (await cli(['compare', ...data, '--split', 'test', '--baseline', 'm3', '--candidate', 'm3']))
        .code,
    ).toBe(1)
    const only = writeRows(rowsCsv([{ cartridge: '308-win', charge: 2.0, velocity: 0.01 }]))
    const none = await cli([
      'verify',
      '--rows',
      only,
      ...data.slice(2),
      '--split',
      'test',
      '--final',
    ])
    expect(none.code).toBe(1)
    expect(none.stderr).toContain('no row of the test split could be evaluated')
  })

  it.each([
    [[]],
    [['run']],
    [['verify']],
    [['verify', '--rows', 'x.csv', '--split', 'all']],
    [['verify', '--rows', 'x.csv', '--json', '--table']],
    [['verify', '--rows', 'x.csv', '--nope']],
    [['verify', '--rows', '/nonexistent/rows.csv']],
    [['compare', ...data, '--baseline', 'm3']],
    [['verify', ...data, '--model', '/nonexistent/model.mjs']],
    [['verify', ...data, '--group-by', 'rifle']],
    [['verify', ...data, '--params', 'fit-on-training']],
    [['verify', ...data, '--params', 'other']],
  ])('is 2 for bad input: %j', async (args) => {
    const { code, stdout } = await cli(args)
    expect(code).toBe(2)
    expect(stdout).toBe('')
  })

  it('is 2 for a rows file with a bad value, naming line and column', async () => {
    const { writeRows } = await import('./fixture.ts')
    const bad = writeRows('cartridge,bullet,powder,charge_g,velocity_ms\n308-win,b,p,x,800\n')
    const { code, stderr } = await cli([
      'verify',
      '--rows',
      bad,
      ...recordRoots.flatMap((r) => ['--records', r]),
    ])
    expect(code).toBe(2)
    expect(stderr).toContain(':2: charge_g is not a number')
  })
})

describe('an unexpected error', () => {
  it.each([
    ['a candidate that throws', new URL('./fixtures/throwing-model.mjs', import.meta.url).pathname],
    ['a directory given as the candidate', join(import.meta.dirname, 'fixtures')],
  ])('ends with one line and exit 2: %s', async (_name, model) => {
    const { code, stdout, stderr } = await cli(['verify', ...data, '--model', model])
    expect(code).toBe(2)
    expect(stdout).toBe('')
    expect(stderr).toMatch(/^[^\n]+\n$/)
    expect(stderr).not.toContain('    at ')
  })
})

describe('defaults', () => {
  it('reads the rows and the records from the environment', async () => {
    const env = { BALLISTICS_ROWS: rowsPath, BALLISTICS_RECORDS: recordRoots.join(':') }
    const { code, stdout } = await cli(['verify'], env)
    expect(code).toBe(0)
    expect(JSON.parse(stdout).split).toBe('validation')
  })

  it('prints a table on a terminal, JSON when asked, and the JSON piped', async () => {
    const table = await cli(['verify', ...data], {}, true)
    expect(table.stdout).toContain('group')
    expect(table.stdout).toContain('family double/extruded')
    expect(table.stdout).toContain('not used:')
    expect(table.stdout).not.toMatch(/table(One|Two)/)
    expect(() => JSON.parse(table.stdout)).toThrow()
    expect(JSON.parse((await cli(['verify', ...data, '--json'], {}, true)).stdout).command).toBe(
      'verify',
    )
    expect((await cli(['verify', ...data, '--table'], {}, false)).stdout).toContain('group')
  })

  it('prints the groups of --group-by in the table', async () => {
    const { stdout } = await cli(['verify', ...data, '--group-by', 'cartridge'], {}, true)
    expect(stdout).toContain('cartridge 308-win')
    const compared = await cli(
      ['compare', ...data, '--group-by', 'cartridge', '--baseline', 'm3', '--candidate', worse],
      {},
      true,
    )
    expect(compared.stdout).toContain('cartridge 308-win')
  })

  it('prints the change of a comparison with its sign', async () => {
    const { stdout } = await cli(
      ['compare', ...data, '--baseline', 'm3', '--candidate', worse],
      {},
      true,
    )
    expect(stdout).toMatch(/^baseline m3 {2}version [0-9a-f]{64}$/m)
    expect(stdout).toMatch(/^all +\+?\d+ +\+8\.10/m)
  })
})
