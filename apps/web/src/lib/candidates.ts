/** The records the app makes of the importers' candidates; loaded only by the import worker and the load-file readers. */
import { type Candidate, idOfKey } from '@open-reloading/importers'
import type { UserRecord } from '@open-reloading/schema'

/** The record of a candidate: its id from its key, saved at `saved`; the caller parses it with the user record schema. */
export const recordOf = ({ key, ...candidate }: Candidate, saved: string): UserRecord =>
  ({ ...candidate, id: idOfKey(key), saved }) as UserRecord
