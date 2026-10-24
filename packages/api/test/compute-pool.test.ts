import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.ts'
import { createComputeRunner } from '../src/compute/pool.ts'
import type { ComputeRunner } from '../src/compute/tasks.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle, flatShot, m3Load } from './fixtures.ts'
import { testCatalogue } from './setup.ts'

const catalogue = testCatalogue(bundle)

/** The smallest output step caps the step size: about 17400 steps per run, 13 runs, about 0.47 s. */
const slow = {
  model: 'm3',
  load: m3Load,
  options: {
    maxTime: 2e-3,
    outputStep: 1e-7,
    relativeTolerance: 1e-12,
    absoluteTolerance: 1e-15,
  },
}
/**
 * Runs until its 3000 ms sampling budget ends, on any machine: 2000 draws of 36 ms each. The deadline of the
 * timeout test sits at half of that, and leaves the replacement worker its start (module load, 0.2 s and
 * more on a busy host) and a fast request.
 */
const endless = { ...slow, sampling: { samples: 2000, budgetMs: 3000 } }
const fast = {
  shot: flatShot,
  ranges: [100],
}

async function withApp(
  options: { workerCount: number; maxQueue: number; timeoutMs: number },
  body: (app: ReturnType<typeof buildApp>, compute: ComputeRunner) => Promise<void>,
) {
  // buildApp closes only a runner it created itself
  const compute = createComputeRunner(options)
  const app = buildApp({ catalogue, compute })
  try {
    await body(app, compute)
  } finally {
    await app.close()
    await compute.close()
  }
}

describe('compute pool through the API', () => {
  it('answers other requests during a computation and 503 busy when the queue is full', async () => {
    await withApp({ workerCount: 1, maxQueue: 0, timeoutMs: 5000 }, async (app, compute) => {
      // start the worker, so the slow request below does not pay for it
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `${API_PREFIX}/exterior/trajectory`,
            payload: fast,
          })
        ).statusCode,
      ).toBe(200)
      const run = vi.spyOn(compute, 'run')
      let done = false
      const running = app
        .inject({ method: 'POST', url: `${API_PREFIX}/interior`, payload: slow })
        .then((r) => {
          done = true
          return r
        })
      // the pool hands the task to the worker within `run`
      await vi.waitFor(() => expect(run).toHaveBeenCalled())
      const root = await app.inject({ url: '/' })
      expect(root.statusCode).toBe(200)
      expect(done).toBe(false)
      const busy = await app.inject({
        method: 'POST',
        url: `${API_PREFIX}/exterior/trajectory`,
        payload: fast,
      })
      expect(busy.statusCode).toBe(503)
      expect(busy.headers['retry-after']).toBe('5')
      expect(busy.json()).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'all compute workers are busy',
        reason: 'busy',
      })
      const res = await running
      expect(res.statusCode).toBe(200)
      expect(res.json().pressureRange.complete).toBe(true)
    })
  })

  it('answers 503 timeout for a slow request and replaces the worker', async () => {
    await withApp({ workerCount: 1, maxQueue: 0, timeoutMs: 1500 }, async (app) => {
      const res = await app.inject({
        method: 'POST',
        url: `${API_PREFIX}/interior`,
        payload: endless,
      })
      expect(res.statusCode).toBe(503)
      expect(res.headers['retry-after']).toBeUndefined()
      expect(res.json()).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'computation did not finish within 1500 ms',
        reason: 'timeout',
        notice: 'simulation, not load data',
      })
      const next = await app.inject({
        method: 'POST',
        url: `${API_PREFIX}/exterior/trajectory`,
        payload: fast,
      })
      expect(next.statusCode).toBe(200)
    })
  })

  it('closes a keep-alive connection after the response in flight when the app closes', async () => {
    const app = buildApp({ catalogue })
    await app.listen({ port: 0, host: '127.0.0.1' })
    const { port } = app.server.address() as AddressInfo
    const received = once(app.server, 'request')
    const pending = fetch(`http://127.0.0.1:${port}${API_PREFIX}/interior`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(slow),
    })
    await received
    const start = Date.now()
    const closed = app.close()
    const res = await pending
    expect(res.status).toBe(200)
    expect(res.headers.get('connection')).toBe('close')
    await res.arrayBuffer()
    await closed
    // without `connection: close` the idle connection keeps the server open for keepAliveTimeout
    expect(Date.now() - start).toBeLessThan(5000)
  })
})
