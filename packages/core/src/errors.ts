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

/** Whether an optional input is absent or a finite number above zero. */
export const positive = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v > 0)

/**
 * Entry `i` of `a`, for an index the caller's loop bounds or array sizes keep inside it. A missing
 * entry is a defect in the caller and throws instead of passing `undefined` into arithmetic.
 */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}
/** An options bag whose entries may be `undefined`, which stands for "not given". */
export type Settings<T> = { [K in keyof T]?: T[K] | undefined }

/** `base` with the own entries of `settings` that are not `undefined`; `base` itself is not changed. */
export function overlay<T extends object>(base: T, settings: Settings<T> | undefined): T {
  const out = { ...base }
  for (const key in settings) {
    if (!Object.hasOwn(settings, key)) continue
    const value = settings[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
