/** Worker entry of the compute pool: one task per message, one reply per task. */
import { parentPort } from 'node:worker_threads'
import { runTask, serializeError, type Task } from './tasks.ts'

parentPort?.on('message', (task: Task) => {
  try {
    parentPort?.postMessage({ succeeded: true, value: runTask(task) })
  } catch (error) {
    parentPort?.postMessage({ succeeded: false, error: serializeError(error) })
  }
})
