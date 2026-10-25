import { InputError, TruingError } from '@open-reloading/core'
import { describe, expect, it, vi } from 'vitest'
import { createPool, type PoolOptions } from '../src/compute/pool.ts'
import { ComputeBusy, ComputeTimeout, reviveError, serializeError } from '../src/compute/tasks.ts'

/** The workers the pool created, last one last. */
const workers = vi.hoisted(() => [] as import('node:worker_threads').Worker[])
vi.mock('node:worker_threads', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:worker_threads')>()
  class Worker extends real.Worker {
    constructor(...args: ConstructorParameters<typeof real.Worker>) {
      super(...args)
      workers.push(this)
    }
  }
  return { ...real, Worker }
})

const filename = new URL('./fixtures/spin-worker.ts', import.meta.url)
const pool = (options: Partial<PoolOptions> = {}) =>
  createPool({ filename, workerCount: 1, maxQueue: 4, timeoutMs: 5000, ...options })
/** Resolves when the newest worker starts its task (spin-worker's `started` message). */
const started = () =>
  new Promise<void>((resolve) =>
    workers.at(-1)?.on('message', (m: { started?: boolean }) => m.started && resolve()),
  )

describe('createPool', () => {
  it('stops a running task at the deadline and keeps the main thread free', async () => {
    const p = pool({ timeoutMs: 1000 })
    await p.run({})
    const spin = p.run({ spin: 60_000 }).catch((e) => e)
    // the main thread takes the worker's message while the task still spins
    expect(await Promise.race([started().then(() => 'free'), spin.then(() => 'settled')])).toBe(
      'free',
    )
    const error = await spin
    expect(error).toBeInstanceOf(ComputeTimeout)
    expect(error.message).toBe('computation did not finish within 1000 ms')
    expect(await p.run({ value: 'next' })).toEqual({ succeeded: true, value: 'next' })
    await p.close()
  })

  it('rejects a task at once when the workers and the queue are full', async () => {
    const p = pool({ maxQueue: 1, timeoutMs: 400 })
    await p.run({})
    const running = p.run({ spin: 1000 }).catch((e) => e)
    const queued = p.run({ value: 'queued' }).catch((e) => e)
    const busy = await p.run({}).catch((e) => e)
    expect(busy).toBeInstanceOf(ComputeBusy)
    expect(busy.retryAfterSeconds).toBe(1)
    expect(await running).toBeInstanceOf(ComputeTimeout)
    expect(await queued).toBeInstanceOf(ComputeTimeout)
    await p.close()
  })

  it('fails the task of a worker that exits or throws, then replaces it', async () => {
    const p = pool()
    const exited = await p.run({ exit: 3 }).catch((e) => e)
    expect(exited).toBeInstanceOf(Error)
    expect(exited.message).toBe('compute worker exited')
    expect(exited.cause.message).toBe('exit code 3')
    const failed = await p.run({ fail: 'boom' }).catch((e) => e)
    expect(failed.message).toBe('compute worker failed')
    expect(failed.cause.message).toBe('boom')
    expect(await p.run({ value: 1 })).toEqual({ succeeded: true, value: 1 })
    await p.close()
  })

  it('rejects queued and running tasks on close and every later task', async () => {
    const p = pool()
    const running = p.run({ spin: 60_000 }).catch((e) => e)
    const queued = p.run({}).catch((e) => e)
    await started()
    await p.close()
    expect((await running).message).toBe('compute pool closed')
    expect((await queued).message).toBe('compute pool closed')
    expect((await p.run({}).catch((e) => e)).message).toBe('compute pool closed')
  })
})

describe('errors across the thread boundary', () => {
  const roundTrip = (e: unknown) => reviveError(structuredClone(serializeError(e)))

  it('rebuilds TruingError, InputError and Error', () => {
    const truing = new TruingError('ill-conditioned', {
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
      detail: 'step limit',
    })
    const t = roundTrip(truing)
    expect(t).toBeInstanceOf(TruingError)
    expect(t).toMatchObject({
      message: truing.message,
      reason: 'ill-conditioned',
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
    })
    const input = roundTrip(new InputError('step limit'))
    expect(input).toBeInstanceOf(InputError)
    expect(input).not.toBeInstanceOf(TruingError)
    expect(input.message).toBe('step limit')
    const range = roundTrip(new RangeError('Invalid array length'))
    expect(range).not.toBeInstanceOf(RangeError)
    expect(range.message).toBe('Invalid array length')
  })
})
