import type { UserRecord } from '@open-reloading/schema'
import type { Diagnostic } from '@open-reloading/statistics'

/** A finding of a reader: its code and the values its message names. The app words it in its language. */
export type ReaderDiagnostic<Code extends string> = Diagnostic<
  Code,
  Readonly<Record<string, string | number | readonly string[]>>
>

/**
 * A record as a reader reads it, without the id and save time the app gives it when it keeps it.
 * Its id is `idOfKey(key)`; the references of the candidates of one read to each other use it.
 */
export type Candidate = UserRecord extends infer R
  ? R extends UserRecord
    ? Omit<R, 'id' | 'saved'> & { key: string }
    : never
  : never
