/**
 * Error core raises on purpose: an input outside the model, or a computation that does not finish
 * within the limits its inputs set. It extends `RangeError`; other errors are defects.
 */
export class InputError extends RangeError {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}

/** Throws an `InputError` with `message` unless `ok`. */
export function need(ok: boolean, message: string): void {
  if (!ok) throw new InputError(message)
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
