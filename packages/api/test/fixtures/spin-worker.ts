/**
 * Test worker for the pool: busy-waits `spin` ms, exits with `exit`, or throws `fail`, then replies.
 * Posts `{ started: true }` first, a message the pool ignores.
 */
import { parentPort } from 'node:worker_threads'

type SpinTask = { spin?: number; exit?: number; fail?: string; value?: unknown }

parentPort?.on('message', (task: SpinTask) => {
  if (task.exit !== undefined) process.exit(task.exit)
  if (task.fail !== undefined) throw new Error(task.fail)
  parentPort?.postMessage({ started: true })
  const end = Date.now() + (task.spin ?? 0)
  let burned = 0
  while (Date.now() < end) burned += Math.sqrt(end)
  // the sum is read so the loop's work is not dead code
  if (burned < 0) throw new Error('unreachable')
  parentPort?.postMessage({ succeeded: true, value: task.value })
})
