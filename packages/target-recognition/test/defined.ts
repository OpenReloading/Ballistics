// For a test that knows an entry exists: narrows it and fails at the access instead of later.
export function missing(): never {
  throw new Error('expected a defined value')
}

export function defined<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a defined value')
  return value
}
