/** An element or lookup a test knows exists: a missing one fails with a message instead of passing `undefined` on. */
export function defined<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`${what} is missing`)
  return value
}
