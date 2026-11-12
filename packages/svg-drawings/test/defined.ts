/** An element a test knows exists, narrowed: a missing one fails the test where it is read. */
export function defined<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`Expected ${what} to exist`)
  return value
}
