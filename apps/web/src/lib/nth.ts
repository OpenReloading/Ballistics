/**
 * Entry `i` of `a`, for an index that the loop bounds or the sizes of the arrays keep inside it. A
 * missing entry is a defect in the caller and throws instead of passing `undefined` into arithmetic.
 */
export function nth<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new RangeError(`index ${i} outside an array of ${a.length}`)
  return v
}

/*
 * Reads of a pixel buffer inside a loop whose bounds keep the index in range. A plain index reads
 * `number | undefined`; these return what the index returns and state `number`, so the pixel
 * arithmetic and its speed stay as they are. One function per array kind keeps each read monomorphic.
 */
export const f32 = (a: Float32Array, i: number) => a[i] as number
export const f64 = (a: Float64Array, i: number) => a[i] as number
export const i8 = (a: Int8Array, i: number) => a[i] as number
export const i32 = (a: Int32Array, i: number) => a[i] as number
export const u8 = (a: Uint8Array | Uint8ClampedArray, i: number) => a[i] as number
