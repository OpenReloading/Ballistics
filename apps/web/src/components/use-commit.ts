import { type RefObject, useLayoutEffect } from 'react'

/** Writes `value` into `ref` once the render commits: a render React discards leaves `ref` alone. */
export function useCommit<T>(ref: RefObject<T>, value: T) {
  useLayoutEffect(() => {
    ref.current = value
  })
}
