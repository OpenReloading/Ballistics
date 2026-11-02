/**
 * Worker-thread pool with a FIFO queue and a wall-clock deadline per task.
 * A worker posts `{ succeeded, ... }` replies; other messages
 * (Node's `--watch` posts its own) are ignored.
 */
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'
import {
  ComputeBusy,
  type ComputeRunner,
  ComputeTimeout,
  reviveError,
  type SerializedError,
  taskTimeoutMs,
} from './tasks.ts'

/** Settings of `createPool`. */
export interface PoolOptions {
  filename: URL
  /** Workers, each running one task at a time. */
  workerCount: number
  /** Tasks waiting for a worker. */
  maxQueue: number
  /** Deadline from submit, queue wait included. */
  timeoutMs: number
}

const workerCount = Math.max(1, availableParallelism() - 1)
/** Default pool: one worker fewer than the available parallelism (at least 1), four queued tasks per worker, a 5000 ms deadline. */
export const poolDefaults: Omit<PoolOptions, 'filename'> = {
  workerCount,
  maxQueue: 4 * workerCount,
  timeoutMs: taskTimeoutMs,
}

/** What a worker posts back: the task value, or the error as a plain object. */
type Reply = { succeeded: true; value: unknown } | { succeeded: false; error: unknown }

/** Handle of a running worker pool: `run` queues one task, `close` ends the workers. */
interface Pool {
  /** Queues `task`; resolves with the worker's reply. Rejections: see `createPool`. */
  run(task: unknown): Promise<Reply>
  /** Rejects the queued and running tasks and ends the workers; later `run` calls reject. */
  close(): Promise<void>
}

type Job = {
  task: unknown
  resolve: (reply: Reply) => void
  reject: (error: Error) => void
  timer?: NodeJS.Timeout
  worker?: Worker
}

/**
 * Creates a pool that starts up to `workerCount` workers on `filename` on demand. A task runs in
 * the first idle worker, else waits in the queue. `run` rejects with `ComputeBusy` when every
 * worker is busy and `maxQueue` tasks wait, or when no worker thread can be started, with
 * `ComputeTimeout` when the task has not finished `timeoutMs` ms after submit (the worker of a
 * running task is terminated; a queued task has none), and with `Error` when the pool is closed or
 * a worker fails. `close` rejects the queued and running tasks and terminates the workers.
 */
export function createPool({ filename, workerCount, maxQueue, timeoutMs }: PoolOptions): Pool {
  const live = new Set<Worker>()
  const idle: Worker[] = []
  const running = new Map<Worker, Job>()
  const queue: Job[] = []
  const retryAfterSeconds = Math.ceil(timeoutMs / 1000)
  let closed = false

  function settle(job: Job) {
    clearTimeout(job.timer)
    return job
  }

  /** Drops a worker; its job, if any, fails with `error`. */
  function drop(worker: Worker, error: Error) {
    if (!live.delete(worker)) return
    const i = idle.indexOf(worker)
    if (i >= 0) idle.splice(i, 1)
    const job = running.get(worker)
    running.delete(worker)
    if (job) settle(job).reject(error)
    const exited = worker.terminate()
    next()
    return exited
  }

  function spawn() {
    // the heaviest request the schemas allow peaks near 64 MB of heap: four times that, so a worker
    // fails with ERR_WORKER_OUT_OF_MEMORY long before the machine runs out
    const worker = new Worker(filename, { resourceLimits: { maxOldGenerationSizeMb: 256 } })
    // the server's socket keeps the process alive, an idle worker does not
    worker.unref()
    live.add(worker)
    worker.on('message', (reply: Reply) => {
      const job = running.get(worker)
      if (!job || typeof reply !== 'object' || reply === null || !('succeeded' in reply)) return
      running.delete(worker)
      idle.push(worker)
      settle(job).resolve(reply)
      next()
    })
    // fixed messages reach the client; the detail stays in `cause` for the server log
    worker.on('error', (e: Error) => drop(worker, new Error('compute worker failed', { cause: e })))
    worker.on('exit', (code) =>
      drop(worker, new Error('compute worker exited', { cause: new Error(`exit code ${code}`) })),
    )
    return worker
  }

  /** Starts queued tasks; never throws, because it also runs in timer and worker callbacks. */
  function next() {
    while (queue.length > 0 && (idle.length > 0 || live.size < workerCount)) {
      const job = queue.shift() as Job
      let worker: Worker
      try {
        worker = idle.pop() ?? spawn()
      } catch (cause) {
        // `new Worker` throws ERR_WORKER_INIT_FAILED (EAGAIN) when no thread can be created
        // every queued job gets the same answer now instead of waiting for its deadline
        settle(job).reject(
          new ComputeBusy('no compute worker could be started', retryAfterSeconds, { cause }),
        )
        continue
      }
      try {
        worker.postMessage(job.task)
      } catch (e) {
        idle.push(worker)
        settle(job).reject(e as Error)
        continue
      }
      job.worker = worker
      running.set(worker, job)
    }
  }

  return {
    run(task) {
      if (closed) return Promise.reject(new Error('compute pool closed'))
      if (idle.length === 0 && live.size >= workerCount && queue.length >= maxQueue)
        return Promise.reject(new ComputeBusy('all compute workers are busy', retryAfterSeconds))
      return new Promise<Reply>((resolve, reject) => {
        const job: Job = { task, resolve, reject }
        job.timer = setTimeout(() => {
          const error = new ComputeTimeout(`computation did not finish within ${timeoutMs} ms`)
          if (job.worker) return drop(job.worker, error)
          const i = queue.indexOf(job)
          if (i >= 0) queue.splice(i, 1)
          reject(error)
        }, timeoutMs)
        queue.push(job)
        next()
      })
    },
    async close() {
      closed = true
      const error = new Error('compute pool closed')
      for (const job of queue.splice(0)) settle(job).reject(error)
      await Promise.all([...live].map((worker) => drop(worker, error)))
    },
  }
}

/** `rewriteRelativeImportExtensions` rewrites import specifiers only, not this URL. */
const workerUrl = new URL(
  import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js',
  import.meta.url,
)

/** A runner on a pool of `worker.ts` (`worker.js` in `dist`). */
export function createComputeRunner(options: Omit<PoolOptions, 'filename'>): ComputeRunner {
  const pool = createPool({ ...options, filename: workerUrl })
  return {
    async run(task) {
      const reply = await pool.run(task)
      if (reply.succeeded) return reply.value as never
      throw reviveError(reply.error as SerializedError)
    },
    close: () => pool.close(),
  }
}
