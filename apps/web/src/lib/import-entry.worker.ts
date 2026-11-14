/** Web Worker of the Import entry: reads tables, builds and plans their records and writes them, `importWorker`. */

import { putRecords, storedRecords } from '@/platform/user-store.ts'
import { importWorker } from './import-entry.ts'

const answer = importWorker({ records: storedRecords, put: putRecords }, (r) => self.postMessage(r))

self.onmessage = (e: MessageEvent) => void answer(e.data)
