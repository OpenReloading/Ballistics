/** Web Worker of the static site: runs one compute task of `@rangefoundry/use-cases` per message. */
import { replyTo, type Task } from '@rangefoundry/use-cases'

self.onmessage = (e: MessageEvent<Task>) => self.postMessage(replyTo(e.data))
