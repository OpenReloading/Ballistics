// A copy of `nth` of `@rangefoundry/statistics`.
/** A missing entry is a defect in the caller and throws instead of passing `undefined` into arithmetic. */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}
