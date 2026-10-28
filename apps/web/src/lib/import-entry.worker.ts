/** Web Worker of the Import entry: reads tables, builds and plans their records and writes them, `importWorker`. */
import { importWorker } from './import-entry.ts'
import { putRecords, storedRecords } from './user-store.ts'

const answer = importWorker(
  { records: async () => (await storedRecords()).records, put: putRecords },
  (r) => self.postMessage(r),
)

self.onmessage = (e: MessageEvent) => void answer(e.data)
