/** Web Worker of the static site: runs one compute task of `@open-reloading/api/compute` per message. */
import { runTask, serializeError, type Task } from '@open-reloading/api/compute'

self.onmessage = (e: MessageEvent<Task>) => {
  try {
    self.postMessage({ succeeded: true, value: runTask(e.data) })
  } catch (error) {
    self.postMessage({ succeeded: false, error: serializeError(error) })
  }
}
