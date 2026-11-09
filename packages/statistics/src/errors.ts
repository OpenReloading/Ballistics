/** A typed diagnostic: a code and the values its message needs, empty when it needs none. */
export type Diagnostic<C extends string = string, P extends object = Record<string, never>> = {
  code: C
  params: P
}

/** An input outside the model, or a computation that does not finish within the limits its inputs set; a `RangeError`, other errors are defects; raised with a typed `issue` (its code is the message) and no wording, though a subclass with fields of its own (`TruingError`, `ValueError`) may pass a message. */
export class InputError extends RangeError {
  /** The typed refusal; undefined for one raised with an English message. */
  readonly issue: Diagnostic<string, object> | undefined

  constructor(refusal: string | Diagnostic<string, object>) {
    super(typeof refusal === 'string' ? refusal : refusal.code)
    this.name = 'InputError'
    this.issue = typeof refusal === 'string' ? undefined : refusal
  }
}

/** Throws an `InputError` with `refusal`, an English message or a typed issue, unless `ok`. */
export function need(ok: boolean, refusal: string | Diagnostic<string, object>): void {
  if (!ok) throw new InputError(refusal)
}

/** For an index the caller's loop bounds or array sizes keep inside it; a missing entry is a defect in the caller and throws instead of passing `undefined` into arithmetic. */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}
