/** Web Worker of the Pages edition: runs one compute task of `@openreloading/api/compute` per message. */
import { runTask, serializeError, type Task } from '@openreloading/api/compute'

self.onmessage = (e: MessageEvent<Task>) => {
  try {
    self.postMessage({ succeeded: true, value: runTask(e.data) })
  } catch (error) {
    self.postMessage({ succeeded: false, error: serializeError(error) })
  }
}
