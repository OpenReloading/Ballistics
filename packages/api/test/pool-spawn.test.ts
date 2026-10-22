import { describe, expect, it, vi } from 'vitest'
import { createPool } from '../src/compute/pool.ts'
import { ComputeBusy, ComputeTimeout } from '../src/compute/tasks.ts'

/** Worker constructions (counted from 1) that throw like Node does when no thread can be created. */
const fail = vi.hoisted(() => ({ on: new Set<number>(), count: 0 }))
/** The workers the pool created, last one last. */
const workers = vi.hoisted(() => [] as import('node:worker_threads').Worker[])
vi.mock('node:worker_threads', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:worker_threads')>()
  class Worker extends real.Worker {
    constructor(...args: ConstructorParameters<typeof real.Worker>) {
      if (fail.on.has(++fail.count))
        throw Object.assign(new Error('EAGAIN'), { code: 'ERR_WORKER_INIT_FAILED' })
      super(...args)
      workers.push(this)
    }
  }
  return { ...real, Worker }
})

const filename = new URL('./fixtures/spin-worker.ts', import.meta.url)
const ms = (n: number) => new Promise((resolve) => setTimeout(resolve, n))
/** Resolves when the newest worker starts its task (spin-worker's `started` message). */
const started = () =>
  new Promise<void>((resolve) =>
    workers.at(-1)?.on('message', (m: { started?: boolean }) => m.started && resolve()),
  )
const failOn = (...n: number[]) => {
  fail.count = 0
  fail.on = new Set(n)
}

describe('createPool when a worker cannot be created', () => {
  it('rejects the queued task with ComputeBusy when the replacement after a timeout fails', async () => {
    failOn(2)
    const p = createPool({ filename, workerCount: 1, maxQueue: 4, timeoutMs: 2000 })
    const running = p.run({ spin: 60_000 }).catch((e) => e)
    await started()
    const queued = await p.run({ value: 'C' }).catch((e) => e)
    expect(await running).toBeInstanceOf(ComputeTimeout)
    expect(queued).toBeInstanceOf(ComputeBusy)
    expect(queued.message).toBe('no compute worker could be started')
    expect(queued.retryAfterSeconds).toBe(2)
    expect(queued.cause.code).toBe('ERR_WORKER_INIT_FAILED')
    expect(await p.run({ value: 'D' })).toEqual({ succeeded: true, value: 'D' })
    await p.close()
  })

  it('answers every queued task at once when a replacement fails, then starts the next', async () => {
    failOn(2)
    const p = createPool({ filename, workerCount: 1, maxQueue: 4, timeoutMs: 2000 })
    const running = p.run({ spin: 60_000 }).catch((e) => e)
    await started()
    // C's deadline comes 1000 ms after the failed replacement, time for the third worker to start
    await ms(1000)
    const b = p.run({ value: 'B' }).catch((e) => e)
    const c = p.run({ value: 'C' }).catch((e) => e)
    expect(await running).toBeInstanceOf(ComputeTimeout)
    expect(await b).toBeInstanceOf(ComputeBusy)
    // C does not wait for its own deadline: the loop goes on and the third construction works
    expect(await c).toEqual({ succeeded: true, value: 'C' })
    await p.close()
  })

  it('clears the deadline of a task whose worker could not be created', async () => {
    failOn(1)
    const p = createPool({ filename, workerCount: 1, maxQueue: 4, timeoutMs: 3000 })
    expect(await p.run({ value: 'A' }).catch((e) => e)).toBeInstanceOf(ComputeBusy)
    await ms(1500)
    // B runs across the deadline of A, C waits behind B
    const b = p.run({ spin: 2000, value: 'B' })
    await started()
    const c = p.run({ value: 'C' })
    expect(await b).toEqual({ succeeded: true, value: 'B' })
    expect(await c).toEqual({ succeeded: true, value: 'C' })
    await p.close()
  })
})
