// A copy of `nth` in core's errors.ts, which core keeps out of its published API.
/**
 * Entry `i` of `a`, for an index that the loop bounds or the sizes of the arrays keep inside it. A
 * missing entry is a defect in the caller and throws instead of passing `undefined` into arithmetic.
 */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}
