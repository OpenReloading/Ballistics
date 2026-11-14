import type { UserRecord } from '@rangefoundry/schema'
import { type Candidate, idOfKey } from '../src/index.ts'

/** The save time of the records the tests make of candidates. */
const saved = '2026-10-30T00:00:00.000Z'

/** The record the app makes of a candidate: its id from the key, saved at a fixed time. */
export const recordOf = ({ key, ...c }: Candidate): UserRecord => ({
  ...c,
  id: idOfKey(key),
  saved,
})
