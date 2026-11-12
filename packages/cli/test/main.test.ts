import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it, vi } from 'vitest'
import { run } from '../src/main.ts'
import { result } from '../src/result.ts'
import { resultJsonSchema } from '../src/write-json-schema.ts'
import { rowsPath } from './data.ts'
import { recordRoots, rowsCsv, writeRows } from './fixture.ts'

vi.mock('@open-reloading/tools/catalog', async (original) =>
  (await import('./records-memo.ts')).memoRecords(
    await original<typeof import('@open-reloading/tools/catalog')>(),
  ),
)

const schemaPath = join(import.meta.dirname, '../schema/result.schema.json')
const worse = new URL('./fixtures/worse-model.mjs', import.meta.url).pathname

/** Runs the command line and returns the exit code and what it wrote. */
async function cli(
  args: string[],
  env: NodeJS.ProcessEnv = {},
  tty = false,
  write = (_text: string) => {},
) {
  let stdout = ''
  let stderr = ''
  const code = await run(args, env, {
    stdout: (t) => {
      write(t)
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

/** Two training rows of one powder that print a pressure, so that `--energy prior` would run on them. */
const pressured = [
  '--rows',
  writeRows(
    rowsCsv(
      [2.0, 2.4].map((charge) => ({
        cartridge: '30-br',
        powder: 'demo-powder-sp30',
        charge,
        velocity: 0,
        pressure: 0,
      })),
    ),
  ),
  ...data.slice(2),
]

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')))

describe('the JSON result', () => {
  // the runs with a fit run the model many times, and the CI runner measures coverage: the default 30 s is too short there
  it('validates against the committed schema, for both commands', {
    timeout: 120_000,
  }, async () => {
    const priorRows = writeRows(
      rowsCsv(
        [
          ['30-br', 2.0],
          ['30-br', 2.4],
          ['308-win', 2.2],
          ['308-match', 2.0],
        ].map(([cartridge, charge]) => ({
          cartridge: cartridge as string,
          powder: 'demo-powder-sp30',
          charge: charge as number,
          velocity: 0,
          pressure: 0,
        })),
      ),
    )
    const prior = ['--rows', priorRows, ...data.slice(2), '--energy', 'prior']
    // a run with `--exponent family` fits every powder of the rows seven times, so it gets few rows of one powder
    const specs = [
      ...[2.0, 2.2, 2.4].map((charge) => ({ cartridge: '30-br', charge, velocity: 0.01 })),
      ...[2.0, 2.2].map((charge) => ({ cartridge: '308-match', charge, velocity: 0.01 })),
    ]
    const few = ['--rows', writeRows(rowsCsv(specs)), ...data.slice(2)]
    const printed = [
      { cartridge: '30-br', charge: 2.0 },
      { cartridge: '30-br', charge: 2.2 },
      { cartridge: '308-match', charge: 2.0 },
    ].map((s) => ({ ...s, velocity: 0, pressure: 0, pressureBasis: 'transducer' }))
    const pressures = ['--rows', writeRows(rowsCsv(printed)), ...data.slice(2)]
    for (const args of [
      ['fit', ...prior],
      ['verify', ...prior, '--params', 'fit-on-training'],
      ['verify', ...data],
      ['verify', ...data, '--split', 'test', '--final'],
      ['verify', ...data, '--group-by', 'construction', '--params', 'records'],
      ['verify', ...data, '--leave-one-powder-out'],
      ['compare', ...data, '--group-by', 'family', '--baseline', 'm3', '--candidate', worse],
      ['compare', ...data, '--baseline', 'm3', '--candidate', worse],
      ['fit', ...data],
      ['verify', ...data, '--params', 'fit-on-training'],
      ['fit', ...few, '--exponent', 'family'],
      ['verify', ...few, '--params', 'fit-on-training', '--exponent', 'family'],
      ['fit', ...pressures, '--pressure-sigma', '0.05'],
      ['verify', ...pressures, '--params', 'fit-on-training', '--pressure-sigma', '0.05'],
    ]) {
      const { code, stdout } = await cli(args)
      expect(code).toBe(0)
      const json = JSON.parse(stdout)
      expect(validate(json), JSON.stringify(validate.errors)).toBe(true)
      expect(json.notice).toBe('simulation, not load data')
      expect(result.safeParse(json).success).toBe(true)
    }
  })

  it('has an absolute $id', () => {
    const { $id } = JSON.parse(readFileSync(schemaPath, 'utf8'))
    expect(new URL($id).href).toBe($id)
    expect($id).toMatch(/\/result\.schema\.json$/)
  })

  it('is the schema the package generates (pnpm run schema)', () => {
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
    const only = writeRows(rowsCsv([{ cartridge: '308-match', charge: 2.0, velocity: 0.01 }]))
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
    [['fit', ...data, '--exponent', 'family', '--pressure-sigma', '0.05']],
    [['fit', ...pressured, '--energy', 'prior', '--exponent', 'family']],
    [['fit', ...pressured, '--energy', 'prior', '--pressure-sigma', '0.05']],
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

  it('is 0 for --version, with the package version on stdout', async () => {
    const { version } = JSON.parse(
      readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'),
    )
    const r = await cli(['--version'])
    expect(r).toEqual({ code: 0, stdout: `ballistics ${version}\n`, stderr: '' })
  })

  it('is 2 with the usage on stderr for no command and for an unknown option', async () => {
    const none = await cli([], {}, true)
    expect(none.code).toBe(2)
    expect(none.stderr).toMatch(/^usage:/)
    const unknown = await cli(['verify', '--rows', 'x.csv', '--nope'], {}, true)
    expect(unknown.code).toBe(2)
    expect(unknown.stderr).toMatch(/^Unknown option '--nope'[^\n]*\n\nusage:/)
    const top = await cli(['--nope'], {}, true)
    expect(top.code).toBe(2)
    expect(top.stderr).toMatch(/^Unknown option '--nope'[^\n]*\n\nusage:/)
  })

  it.each([
    ['run', ['run', 'interior', '--input', 'x.json', '--table'], /usage: ballistics run </],
    ['operations', ['operations', '--table'], /usage: ballistics operations\n/],
  ])('is 2 with the help of %s for an unknown option of it', async (_, args, help) => {
    const { code, stderr } = await cli(args, {}, true)
    expect(code).toBe(2)
    expect(stderr).toMatch(/^Unknown option '--table'/)
    expect(stderr).toMatch(help)
    expect(stderr).not.toContain('--group-by')
  })

  it('is 1 for a refused run, naming the invalid field on a terminal', async () => {
    const body = JSON.parse(
      readFileSync(join(import.meta.dirname, '../examples/interior.json'), 'utf8'),
    )
    body.load.propellant.gamma = 1
    const dir = mkdtempSync(join(tmpdir(), 'cli-refused-'))
    const input = join(dir, 'body.json')
    writeFileSync(input, JSON.stringify(body))
    const { code, stderr } = await cli(['run', 'interior', '--input', input], {}, true)
    expect(code).toBe(1)
    expect(stderr).toBe('refused: interior: input (propellant.gamma)\n')
  })

  it('is 2 for a rows file with a bad value, naming line and column', async () => {
    const { writeRows } = await import('./fixture.ts')
    const bad = writeRows('cartridge,bullet,powder,charge_g,velocity_ms\n308-match,b,p,x,800\n')
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
    const { code, stdout, stderr } = await cli(['verify', ...data, '--model', model], {}, true)
    expect(code).toBe(2)
    expect(stdout).toBe('')
    expect(stderr).toMatch(/^[^\n]+\n$/)
    expect(stderr).not.toContain('    at ')
    expect(JSON.parse((await cli(['verify', ...data, '--model', model])).stderr).error.kind).toBe(
      'usage',
    )
  })
})

describe('an error', () => {
  const full = () => {
    throw new Error('no space left\non the device')
  }

  it.each([
    ['usage', 2, ['verify', '--rows', 'x.csv', '--nope'], undefined, /^Unknown option '--nope'/],
    ['refused', 1, ['verify', ...data, '--split', 'test'], undefined, /^refused: the test split/],
    ['internal', 3, ['verify', ...data], full, /^error: no space left on the device\n$/],
  ] as const)(
    'of kind %s exits %i, one JSON object on stderr when piped or with --json, else text',
    async (kind, exit, args, write, text) => {
      for (const [extra, tty] of [
        [[], false],
        [['--json'], true],
      ] as const) {
        const r = await cli([...args, ...extra], {}, tty, write)
        expect(r.code).toBe(exit)
        expect(r.stderr).toMatch(/^[^\n]+\n$/)
        expect(JSON.parse(r.stderr)).toEqual({ error: { kind, message: expect.any(String) } })
      }
      const terminal = await cli([...args], {}, true, write)
      expect(terminal.code).toBe(exit)
      expect(terminal.stderr).toMatch(text)
    },
  )
})

describe('the process', () => {
  const bin = join(import.meta.dirname, '../src/bin.ts')

  it('ends quietly with 0 when the reader closes the pipe', async () => {
    const child = spawn(process.execPath, [bin, 'operations'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // the read end closes before the first write, so every write meets EPIPE
    child.stdout.destroy()
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    const code = await new Promise((resolve) => child.on('close', resolve))
    expect(stderr).toBe('')
    expect(code).toBe(0)
  })

  it.runIf(existsSync('/dev/full'))(
    'reports a failed stdout write as the JSON error and ends with 3',
    () => {
      // every write to /dev/full fails with ENOSPC
      const full = openSync('/dev/full', 'w')
      const r = spawnSync(process.execPath, [bin, 'operations'], {
        stdio: ['ignore', full, 'pipe'],
        encoding: 'utf8',
      })
      closeSync(full)
      expect(JSON.parse(r.stderr)).toEqual({
        error: { kind: 'internal', message: expect.stringContaining('ENOSPC') },
      })
      expect(r.status).toBe(3)
    },
  )

  it('reads the rows from standard input for --rows -', () => {
    const r = spawnSync(process.execPath, [bin, 'verify', '--rows', '-', ...data.slice(2)], {
      input: readFileSync(rowsPath),
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    const fromFile = spawnSync(process.execPath, [bin, 'verify', ...data], { encoding: 'utf8' })
    expect(JSON.parse(r.stdout).overall).toEqual(JSON.parse(fromFile.stdout).overall)
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
    expect(stdout).toContain('cartridge 308-match')
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
    expect(compared.stdout).toContain('cartridge 308-match')
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
