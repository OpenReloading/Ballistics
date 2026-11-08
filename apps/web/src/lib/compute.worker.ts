/** Web Worker of the static site: runs one compute task of `@open-reloading/use-cases` per message. */
import { replyTo, type Task } from '@open-reloading/use-cases'

self.onmessage = (e: MessageEvent<Task>) => self.postMessage(replyTo(e.data))
