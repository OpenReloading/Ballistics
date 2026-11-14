import { interior } from '@rangefoundry/ballistics'
import { inlineRunner, operations } from '@rangefoundry/use-cases'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { file, m3Load, siValues } from './fixtures.ts'
import { checkBody, withApi } from './setup.ts'

const api = withApi({ compute: inlineRunner })

/** The 200 schema of the route `name`, as the app documents it. */
const response = (name: string) => defined(operations.find((o) => o.name === name)).response

/** Checks a 200 body against the zod schema and its JSON Schema of the contract document, also with a field added at the top and in the first object `extra` names. */
function check(schema: z.ZodType, body: Record<string, unknown>, extra: string) {
  const { json, validate } = checkBody(schema, body)
  expect(json).not.toHaveProperty('$defs')
  const added = { ...body, added: 1, [extra]: { ...(body[extra] as object), added: 1 } }
  expect(validate(added), JSON.stringify(validate.errors)).toBe(true)
}

async function post(path: string, payload: unknown) {
  const res = await api.post(`${API_PREFIX}${path}`, payload)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

describe('interior response schemas', () => {
  it('match one run of POST /interior', async () => {
    const body = await post('/interior', { model: 'm3', load: m3Load })
    expect(body.result.points.length).toBeGreaterThan(0)
    check(response('interior'), body, 'result')
  })

  it('match one run with a cartridge id, with limits', async () => {
    const body = await post('/interior', { model: 'm3', load: m3Load, cartridge: 'alpha-rifle' })
    expect(body.limits.length).toBeGreaterThan(0)
    expect(body.resolved.cartridge.id).toBe('alpha-rifle')
    check(response('interior'), body, 'pressureRange')
  })

  it('match a ladder with a valid step and an invalid one', async () => {
    // the last step does not fit the chamber
    const body = await post('/interior', {
      model: 'm3',
      load: m3Load,
      cartridge: 'alpha-rifle',
      ladder: { chargeStep: 0.001, stepCount: 4 },
    })
    expect(body.ladderSteps[0]).toHaveProperty('result')
    expect(body.ladderSteps[3]).toHaveProperty('error')
    check(response('interior'), body, 'resolved')
  })

  it('match POST /interior/load-file without curves', async () => {
    const body = await post(
      '/interior/load-file',
      file({ siValues, cartridge: 'beta-pistol', bullet: 'example-a-1', powder: 'example-a-fast' }),
    )
    expect(body).not.toHaveProperty('points')
    expect(body.resolved.powder.id).toBe('example-a-fast')
    expect(body.resolved.bullet.id).toBe('example-a-1')
    check(response('interior/load-file'), body, 'summary')
  })

  it('match POST /interior/load-file with curves and a ladder', async () => {
    const ladder = { stepCount: 3, chargeStep: 0.0001, direction: 'around' }
    const res = await api.app.inject({
      method: 'POST',
      url: `${API_PREFIX}/interior/load-file?curves=true`,
      payload: file({ siValues, ladder }),
    })
    expect(res.statusCode, res.body).toBe(200)
    const body = res.json()
    expect(body.points.length).toBeGreaterThan(0)
    expect(body.ladderSteps).toHaveLength(3)
    check(response('interior/load-file'), body, 'units')
  })

  it('match POST /interior/charge-target', async () => {
    const run = interior(m3Load, { maxTime: 0.04, maxSteps: 10000 })
    if (!run.valid) throw new Error(run.reason)
    const body = await post('/interior/charge-target', {
      load: { ...m3Load, charge: 0.001 },
      target: { kind: 'peakPressure', value: run.peakBreechPressure },
      cartridge: 'alpha-rifle',
      powder: 'example-a-fast',
    })
    expect(body.resolved.powder.id).toBe('example-a-fast')
    expect(body.limits.length).toBeGreaterThan(0)
    check(response('interior/charge-target'), body, 'result')
  })
})
