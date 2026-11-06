/** A typed diagnostic: a code and the values its message needs, empty when it needs none. */
export type Diagnostic<C extends string = string, P extends object = Record<string, never>> = {
  code: C
  params: P
}

/**
 * Error the logic packages raise on purpose: an input outside the model, or a computation that does
 * not finish within the limits its inputs set. It extends `RangeError`; other errors are defects.
 * A package that words nothing raises it with a typed `issue` (its code is the message); the others
 * still raise it with an English message and no issue.
 */
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

/**
 * Entry `i` of `a`, for an index the caller's loop bounds or array sizes keep inside it. A missing
 * entry is a defect in the caller and throws instead of passing `undefined` into arithmetic.
 */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}
