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
