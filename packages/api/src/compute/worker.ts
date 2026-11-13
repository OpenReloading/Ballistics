/** Worker entry of the compute pool: one task per message, one reply per task. */
import { parentPort } from 'node:worker_threads'
import { replyTo, type Task } from '@rangefoundry/use-cases'

parentPort?.on('message', (task: Task) => parentPort?.postMessage(replyTo(task)))
