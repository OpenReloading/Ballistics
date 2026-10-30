import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { operation, operations } from '@open-reloading/api/compute'
import { startBundleApi } from '@open-reloading/api/static'
import { Ajv2020 } from 'ajv/dist/2020.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { run } from '../src/main.ts'

const root = join(import.meta.dirname, '../../..')
const example = join(import.meta.dirname, '../examples/interior.json')
const dir = mkdtempSync(join(tmpdir(), 'cli-run-'))

/** Writes `body` as JSON to a file of the temporary folder and returns its path. */
function bodyFile(name: string, body: unknown) {
  const path = join(dir, `${name.replaceAll('/', '-')}.json`)
  writeFileSync(path, typeof body === 'string' ? body : JSON.stringify(body))
  return path
}

/** Runs the command line and returns the exit code and what it wrote. */
async function cli(args: string[], env: NodeJS.ProcessEnv = {}) {
  let stdout = ''
  let stderr = ''
  const code = await run(args, env, {
    stdout: (t) => {
      stdout += t
    },
    stderr: (t) => {
      stderr += t
    },
    tty: false,
  })
  return { code, stdout, stderr }
}

const errorOf = (stderr: string) => JSON.parse(stderr).error

describe('run', () => {
  let api: Awaited<ReturnType<typeof startBundleApi>>
  beforeAll(async () => {
    api = await startBundleApi()
  })
  afterAll(() => api.close())

  it.each(operations.map((o) => o.name))('answers %s as its route does', async (name) => {
    const body = defined(operation(name)).example
    const { code, stdout, stderr } = await cli(['run', name, '--input', bodyFile(name, body)])
    expect(stderr).toBe('')
    expect(code).toBe(0)
    const route = await api.app.inject({
      method: 'POST',
      url: `/v1/${name}`,
      payload: body as object,
    })
    expect(route.statusCode).toBe(200)
    // the identity fields are added by the server's hook, the browser entry adds none
    const { inputHash: _h, apiVersion: _v, dataHash: _d, ...answer } = route.json()
    expect(JSON.parse(stdout)).toEqual(answer)
  })
})

describe('run offline', () => {
  it('writes the same bytes twice, with no network', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('no network')))
    vi.stubGlobal('fetch', fetch)
    try {
      const args = ['run', 'interior', '--input', example]
      const first = await cli(args)
      const second = await cli(args)
      expect(first.code).toBe(0)
      expect(second.stdout).toBe(first.stdout)
      expect(JSON.parse(first.stdout).notice).toBe('simulation, not load data')
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('has a committed example equal to the route example', () => {
    expect(JSON.parse(readFileSync(example, 'utf8'))).toEqual(
      defined(operation('interior')).example,
    )
  })

  it('refuses a body the schema rejects, with the issues', async () => {
    const { code, stderr } = await cli([
      'run',
      'interior',
      '--input',
      bodyFile('bad', { model: 'm3' }),
    ])
    expect(code).toBe(2)
    const error = errorOf(stderr)
    expect(error.kind).toBe('usage')
    expect(error.issues.length).toBeGreaterThan(0)
    expect(error.issues[0]).toHaveProperty('path')
  })

  it('answers a 422 of the route as a refusal with the answer', async () => {
    const body = structuredClone(defined(operation('interior/charge-target')).example) as {
      target: Record<string, unknown>
    }
    body.target = { kind: 'muzzleVelocity', value: 9000 }
    const { code, stderr } = await cli([
      'run',
      'interior/charge-target',
      '--input',
      bodyFile('unreachable', body),
    ])
    expect(code).toBe(1)
    const error = errorOf(stderr)
    expect(error.kind).toBe('refused')
    expect(error.answer.statusCode).toBe(422)
    expect(error.answer.notice).toBe('simulation, not load data')
  })

  it('answers an input error of the run as a refusal', async () => {
    const body = {
      ...(defined(operation('interior/charge-target')).example as object),
      powder: 'demo-powder-dp40',
      target: { kind: 'loadRatio', value: 0.9 },
    }
    const { code, stderr } = await cli([
      'run',
      'interior/charge-target',
      '--input',
      bodyFile('density', body),
    ])
    expect(code).toBe(1)
    const error = errorOf(stderr)
    expect(error.message).toBe('powder demo-powder-dp40 has no bulk density')
    expect(error.answer.statusCode).toBe(422)
  })

  it('notes the problems of the records on stderr and still answers', async () => {
    const records = join(dir, 'records')
    mkdirSync(join(records, 'powders'), { recursive: true })
    writeFileSync(join(records, 'powders', 'broken.json'), '{}')
    const { code, stderr } = await cli([
      'run',
      'interior',
      '--input',
      example,
      '--records',
      records,
    ])
    expect(code).toBe(0)
    expect(stderr).toMatch(/^\d+ problem\(s\) in the records/)
  })

  it('refuses an unknown record id as bad input', async () => {
    const body = { ...(defined(operation('interior')).example as object), cartridge: 'no-such' }
    const { code, stderr } = await cli(['run', 'interior', '--input', bodyFile('id', body)])
    expect(code).toBe(2)
    expect(errorOf(stderr).message).toBe('cartridge no-such not found')
  })

  it.each([
    [
      ['run', 'nothing', '--input', example],
      'unknown operation nothing: one of exterior/trajectory',
    ],
    [['run', 'interior'], 'usage: ballistics run'],
    [['run', 'interior', 'extra', '--input', example], 'usage: ballistics run'],
    [
      ['run', 'interior', '--input', join(dir, 'missing.json')],
      'the --input cannot be read: ENOENT',
    ],
    [['run', 'interior', '--input', bodyFile('text', 'not json')], 'the --input is not JSON'],
    [['run', 'interior', '--input', example, '--records', join(dir, 'none')], 'the --records path'],
    [['operations', '--input', example], "Unknown option '--input'"],
  ])('refuses %j as bad input', async (args, message) => {
    const { code, stderr } = await cli(args)
    expect(code).toBe(2)
    expect(errorOf(stderr).message).toContain(message)
  })
})

describe('operations', () => {
  it('lists every operation with input and output schemas that compile', async () => {
    const { code, stdout } = await cli(['operations'])
    expect(code).toBe(0)
    const listed = JSON.parse(stdout).operations
    expect(listed.map((o: { name: string }) => o.name)).toEqual(operations.map((o) => o.name))
    const ajv = new Ajv2020({ strict: false })
    for (const o of listed) {
      expect(o.summary).toBeTruthy()
      expect(o.input.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
      const input = ajv.compile(o.input)
      ajv.compile(o.output)
      expect(input(defined(operation(o.name)).example), o.name).toBe(true)
    }
  })
})

describe('help', () => {
  it.each(['run', 'operations'])('of %s has an example that runs', (command) => {
    const help = spawnSync('node', ['packages/cli/src/bin.ts', command, '--help'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(help.status).toBe(0)
    const line = defined(help.stdout.split('\n').find((l) => l.startsWith('  node ')))
    const [, ...args] = line.trim().split(' ')
    const ran = spawnSync(
      'node',
      args.map((a) => a.replace('/dist/bin.js', '/src/bin.ts')),
      {
        cwd: root,
        encoding: 'utf8',
      },
    )
    expect(ran.stderr).toBe('')
    expect(ran.status).toBe(0)
    expect(JSON.parse(ran.stdout)).toBeTypeOf('object')
  })

  it('reads the body from stdin', () => {
    const ran = spawnSync('node', ['packages/cli/src/bin.ts', 'run', 'interior', '--input', '-'], {
      cwd: root,
      encoding: 'utf8',
      input: readFileSync(example),
    })
    expect(ran.status).toBe(0)
    expect(JSON.parse(ran.stdout).notice).toBe('simulation, not load data')
  })
})

/** `value`, failing the test when it is undefined. */
function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a value')
  return value
}
