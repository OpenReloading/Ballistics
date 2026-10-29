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
      ['verify', ...data, '--leave-one-powder-out'],
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

  it('names the position of a records root that is not a folder', async () => {
    const r = await cli(['verify', ...data, '--records', '/nonexistent/records'])
    expect(r.stderr).toContain(
      `the --records path ${recordRoots.length + 1} of ${recordRoots.length + 1} (or BALLISTICS_RECORDS) does not exist`,
    )
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
    [['verify', '--rows', rowsPath, '--records', '/nonexistent/records']],
    [['verify', ...data, '--records', rowsPath]],
    [['compare', ...data, '--baseline', 'm3', '--candidate', 'm3', '--model', 'm3']],
    [['verify', ...data, '--candidate', 'm3']],
    [['verify', ...data, '--baseline', 'm3']],
    [['compare', ...data, '--baseline', 'm3', '--candidate', 'm3', '--leave-one-powder-out']],
    [['verify', ...data, '--final']],
    [['verify', ...data, '--split', 'training', '--final']],
    [['compare', ...data, '--baseline', 'm3', '--candidate', 'm3', '--final']],
  ])('is 2 for bad input: %j', async (args) => {
    const { code, stdout } = await cli(args)
    expect(code).toBe(2)
    expect(stdout).toBe('')
  })

  it.each([[['--help']], [['-h']], [['verify', '--help']], [['compare', ...data, '-h']]])(
    'is 0 for help, with the usage on stdout: %j',
    async (args) => {
      const { code, stdout, stderr } = await cli(args)
      expect(code).toBe(0)
      expect(stdout).toMatch(/^usage:/)
      expect(stderr).toBe('')
    },
  )

  it('is 2 with the usage on stderr for no command and for an unknown option', async () => {
    const none = await cli([])
    expect(none.code).toBe(2)
    expect(none.stderr).toMatch(/^usage:/)
    const unknown = await cli(['verify', '--rows', 'x.csv', '--nope'])
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toMatch(/^Unknown option '--nope'[^\n]*\n\nusage:/)
    const top = await cli(['--nope'])
    expect(top.code).toBe(2)
    expect(top.stderr).toMatch(/^Unknown option '--nope'[^\n]*\n\nusage:/)
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

describe('a candidate with a velocity that is not a number', () => {
  const nan = new URL('./fixtures/nan-model.mjs', import.meta.url).pathname

  it('refuses those rows, keeps every statistic a number, and re-reads as a baseline', async () => {
    const r = await cli(['verify', ...data, '--model', nan])
    expect(r.code).toBe(0)
    const json = JSON.parse(r.stdout)
    expect(json.overall.rows.notUsed.modelRefused).toBeGreaterThan(0)
    for (const m of [json.overall, ...Object.values<{ velocity: object }>(json.byFamily)])
      expect(m.velocity === null || Object.values(m.velocity).every(Number.isFinite)).toBe(true)
    expect(Number.isFinite(json.overall.velocity.median)).toBe(true)
    expect(Number.isFinite(json.interval.halfWidth)).toBe(true)
    expect(result.safeParse(json).success).toBe(true)
    const baseline = writeRows(r.stdout, 'baseline.json')
    expect(
      (await cli(['compare', ...data, '--baseline', baseline, '--candidate', 'm3'])).code,
    ).toBe(0)
  })
})

describe('an unexpected error', () => {
  it.each([
    ['a candidate that throws', new URL('./fixtures/throwing-model.mjs', import.meta.url).pathname],
    [
      'a candidate that throws a coded TypeError',
      new URL('./fixtures/coded-type-error-model.mjs', import.meta.url).pathname,
    ],
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
    expect(stdout).not.toContain('powder not in the fitted set')
    const unseen = await cli(['verify', ...data, '--leave-one-powder-out'], {}, true)
    expect(unseen.stdout).toContain(
      'powder not in the fitted set: no data (2 powders without a value)',
    )
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
