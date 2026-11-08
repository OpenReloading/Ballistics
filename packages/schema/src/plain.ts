/** A JSON object: an object that is no array. */
export type Plain = Record<string, unknown>

/** Whether `x` is a {@link Plain} object. */
export const isPlain = (x: unknown): x is Plain =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
